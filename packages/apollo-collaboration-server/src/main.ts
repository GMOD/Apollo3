/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import fs from 'node:fs'

import { checkRegistry } from '@apollo-annotation/common'
import { CDSCheck, TranscriptCheck } from '@apollo-annotation/shared'
import type { LogLevel } from '@nestjs/common'
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import connectMongoDBSession from 'connect-mongodb-session'
import cookieParser from 'cookie-parser'
import { json, urlencoded } from 'express'
import session from 'express-session'

import { AppModule } from './app.module.js'
import { GlobalExceptionsFilter } from './global-exceptions.filter.js'
import { ApolloLogger } from './utils/apollo-logger.service.js'
import { LoggingInterceptor } from './utils/logging.interceptor.js'

const MongoDBStore = connectMongoDBSession(session)

async function bootstrap() {
  // Can't use config service here since app doesn't exist yet, but stringified
  // configs are available in process.env
  const {
    CORS,
    LOG_LEVELS,
    MONGODB_URI,
    MONGODB_URI_FILE,
    PORT,
    SESSION_SECRET,
    SESSION_SECRET_FILE,
  } = process.env
  if (!CORS) {
    throw new Error('No CORS found in .env file')
  }
  if (!LOG_LEVELS) {
    throw new Error('No LOG_LEVELS found in .env file')
  }
  if (!PORT) {
    throw new Error('No PORT found in .env file')
  }
  let mongodbURI = MONGODB_URI
  if (!mongodbURI) {
    if (!MONGODB_URI_FILE) {
      throw new Error('No MONGODB_URI or MONGODB_URI_FILE found in .env file')
    }
    mongodbURI = fs.readFileSync(MONGODB_URI_FILE, 'utf8').trim()
  }

  let sessionSecret = SESSION_SECRET
  if (!sessionSecret) {
    if (!SESSION_SECRET_FILE) {
      throw new Error(
        'No SESSION_SECRET or SESSION_SECRET_FILE found in .env file',
      )
    }
    sessionSecret = fs.readFileSync(SESSION_SECRET_FILE, 'utf8').trim()
  }

  const cdsCheck = new CDSCheck()
  checkRegistry.registerCheck(cdsCheck.name, cdsCheck)

  const transcriptCheck = new TranscriptCheck()
  checkRegistry.registerCheck(transcriptCheck.name, transcriptCheck)

  const cors = convertToBoolean(CORS)

  const logLevels = LOG_LEVELS.split(',') as LogLevel[]
  const logger = new ApolloLogger('Apollo', { logLevels })

  const app = await NestFactory.create(AppModule, { logger, cors })

  // When collecting coverage, exit cleanly on signals so V8 writes the coverage
  // data. The default signal handlers kill the process before it's written.
  if (process.env.NODE_V8_COVERAGE) {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        process.exit(0)
      })
    }
  } else {
    // Close the app and exit on these signals, so process managers like PM2 and
    // container runtimes can stop this process cleanly. Exit explicitly instead
    // of using app.enableShutdownHooks(), which re-sends the signal to exit, and
    // a re-sent signal is ignored when this is PID 1 (e.g. in a container).
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        logger.log(`Received ${signal}, shutting down`)
        // A second signal exits right away
        process.once(signal, () => {
          process.exit(1)
        })
        // These exits are still part of handling the signal, which the lint
        // rule can't tell once they're inside a callback
        app.close().then(
          () => {
            // eslint-disable-next-line unicorn/no-process-exit
            process.exit(0)
          },
          (error: unknown) => {
            logger.error(
              'Error while shutting down',
              error instanceof Error ? error.stack : String(error),
            )
            // eslint-disable-next-line unicorn/no-process-exit
            process.exit(1)
          },
        )
      })
    }
  }

  const { httpAdapter } = app.get(HttpAdapterHost)
  app.useGlobalFilters(new GlobalExceptionsFilter(httpAdapter))
  app.useGlobalInterceptors(new LoggingInterceptor())

  app.use(json({ limit: '50mb' }))
  app.use(urlencoded({ extended: true, limit: '50mb' }))
  app.use(cookieParser())

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new MongoDBStore({
        uri: mongodbURI,
        collection: 'expressSessions',
      }),
    }),
  )

  const server = await app.listen(PORT)
  server.headersTimeout = 24 * 60 * 60 * 1000 // one day
  server.requestTimeout = 24 * 60 * 60 * 1000 // one day

  logger.log(`Application is running on: ${await app.getUrl()}, CORS = ${cors}`)
}
// eslint-disable-next-line unicorn/prefer-top-level-await
void bootstrap()

function convertToBoolean(input: string): boolean | undefined {
  try {
    return JSON.parse(input)
  } catch {
    return undefined
  }
}
