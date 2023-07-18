import fs from 'fs'

import { LogLevel } from '@nestjs/common'
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import { changeRegistry, operationRegistry } from 'apollo-common'
import {
  CoreValidation,
  ParentChildValidation,
  changes,
  operations,
  validationRegistry,
} from 'apollo-shared'
import connectMongoDBSession from 'connect-mongodb-session'
import session from 'express-session'

import { AppModule } from './app.module'
import { GlobalExceptionsFilter } from './global-exceptions.filter'
import { AuthorizationValidation } from './utils/validation/AuthorizationValidation'

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
    mongodbURI = fs.readFileSync(MONGODB_URI_FILE, 'utf-8').trim()
  }

  let sessionSecret = SESSION_SECRET
  if (!sessionSecret) {
    if (!SESSION_SECRET_FILE) {
      throw new Error(
        'No SESSION_SECRET or SESSION_SECRET_FILE found in .env file',
      )
    }
    sessionSecret = fs.readFileSync(SESSION_SECRET_FILE, 'utf-8').trim()
  }

  Object.entries(changes).forEach(([changeName, change]) => {
    changeRegistry.registerChange(changeName, change)
  })

  Object.entries(operations).forEach(([operationName, operation]) => {
    operationRegistry.registerOperation(operationName, operation)
  })

  validationRegistry.registerValidation(new CoreValidation())
  validationRegistry.registerValidation(new AuthorizationValidation())
  validationRegistry.registerValidation(new ParentChildValidation())

  const cors = convertToBoolean(CORS)

  const logLevels = LOG_LEVELS.split(',') as LogLevel[]

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
    cors,
  })

  const { httpAdapter } = app.get(HttpAdapterHost)
  app.useGlobalFilters(new GlobalExceptionsFilter(httpAdapter))

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

  await app.listen(PORT)
  // eslint-disable-next-line no-console
  console.log(
    `Application is running on: ${await app.getUrl()}, CORS = ${cors}`,
  )
}
void bootstrap()

function convertToBoolean(input: string): boolean | undefined {
  try {
    return JSON.parse(input)
  } catch (e) {
    return undefined
  }
}
