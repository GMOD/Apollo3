/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import fs from 'node:fs'

import {
  type Check,
  changeRegistry,
  checkRegistry,
  operationRegistry,
} from '@apollo-annotation/common'
import { CheckSchema } from '@apollo-annotation/schemas'
import {
  CDSCheck,
  CoreValidation,
  ParentChildValidation,
  TranscriptCheck,
  changes,
  operations,
  validationRegistry,
} from '@apollo-annotation/shared'
import { type LogLevel } from '@nestjs/common'
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import connectMongoDBSession from 'connect-mongodb-session'
import { json, urlencoded } from 'express'
import session from 'express-session'
import mongoose from 'mongoose'

import { AppModule } from './app.module.js'
import { GlobalExceptionsFilter } from './global-exceptions.filter.js'
import { AuthorizationValidation } from './utils/validation/AuthorizationValidation.js'

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

  for (const [changeName, change] of Object.entries(changes)) {
    changeRegistry.registerChange(changeName, change)
  }

  for (const [operationName, operation] of Object.entries(operations)) {
    operationRegistry.registerOperation(operationName, operation)
  }

  const cdsCheck = new CDSCheck()
  checkRegistry.registerCheck(cdsCheck.name, cdsCheck)

  const transcriptCheck = new TranscriptCheck()
  checkRegistry.registerCheck(transcriptCheck.name, transcriptCheck)

  validationRegistry.registerValidation(new CoreValidation())
  validationRegistry.registerValidation(new AuthorizationValidation())
  validationRegistry.registerValidation(new ParentChildValidation())

  const cors = convertToBoolean(CORS)

  const logLevels = LOG_LEVELS.split(',') as LogLevel[]

  const app = await NestFactory.create(AppModule, { logger: logLevels, cors })

  const { httpAdapter } = app.get(HttpAdapterHost)
  app.useGlobalFilters(new GlobalExceptionsFilter(httpAdapter))

  app.use(json({ limit: '50mb' }))
  app.use(urlencoded({ extended: true, limit: '50mb' }))

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

  // Add/update checks if needed
  const checksMap: Map<string, Check> = checkRegistry.getChecks()
  await mongoose.connect(mongodbURI, {})
  const ChecksModel = mongoose.model('checks', CheckSchema)
  for (const [key, check] of checksMap.entries()) {
    const checkByName = await ChecksModel.find({ name: key }).exec()
    const firstCheck = checkByName.at(0)
    if (firstCheck) {
      const checkByNameAndVersion = await ChecksModel.find({
        name: key,
        version: check.version,
      }).exec()
      if (checkByNameAndVersion.length === 0) {
        firstCheck.version = check.version
        await firstCheck.save()
      }
    } else {
      await ChecksModel.create(check)
    }
  }
  // eslint-disable-next-line no-console
  console.log(
    `Application is running on: ${await app.getUrl()}, CORS = ${cors}`,
  )
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
