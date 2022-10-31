/* eslint-disable @typescript-eslint/no-var-requires */
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import {
  CoreValidation,
  ParentChildValidation,
  changeRegistry,
  changes,
  validationRegistry,
} from 'apollo-shared'

import { AppModule } from './app.module'
import { GlobalExceptionsFilter } from './global-exceptions.filter'
import { AuthorizationValidation } from './utils/validation/AuthorizationValidation'

async function bootstrap() {
  const { CORS, LOGGER_OPTIONS, APPLICATION_PORT } = process.env
  if (!CORS) {
    throw new Error('No CORS found in .env file')
  }
  if (!LOGGER_OPTIONS) {
    throw new Error('No LOGGER_OPTIONS found in .env file')
  }
  if (!APPLICATION_PORT) {
    throw new Error('No APPLICATION_PORT found in .env file')
  }

  Object.entries(changes).forEach(([changeName, change]) => {
    changeRegistry.registerChange(changeName, change)
  })

  validationRegistry.registerValidation(new CoreValidation())
  validationRegistry.registerValidation(new AuthorizationValidation())
  validationRegistry.registerValidation(new ParentChildValidation())

  const cors = convertToBoolean(CORS)

  const loggerOpions = JSON.parse(LOGGER_OPTIONS)
  const app = await NestFactory.create(AppModule, {
    logger: loggerOpions,
    cors,
  })

  const { httpAdapter } = app.get(HttpAdapterHost)
  app.useGlobalFilters(new GlobalExceptionsFilter(httpAdapter))

  const session = require('express-session')
  const FileStore = require('session-file-store')(session)
  const fileStoreOptions = {}
  app.use(
    session({
      store: new FileStore(fileStoreOptions),
      secret: 'keyboard cat',
    }),
  )

  await app.listen(APPLICATION_PORT)
  // eslint-disable-next-line no-console
  console.log(
    `Application is running on: ${await app.getUrl()}, CORS = ${cors}`,
  )
}
bootstrap()

function convertToBoolean(input: string): boolean | undefined {
  try {
    return JSON.parse(input)
  } catch (e) {
    return undefined
  }
}
