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
import session from 'express-session'

import { AppModule } from './app.module'
import { GlobalExceptionsFilter } from './global-exceptions.filter'
import { AuthorizationValidation } from './utils/validation/AuthorizationValidation'

async function bootstrap() {
  // Can't use config service here since app doesn't exist yet, but stringified
  // configs are available in process.env
  const { CORS, LOG_LEVELS, PORT } = process.env
  if (!CORS) {
    throw new Error('No CORS found in .env file')
  }
  if (!LOG_LEVELS) {
    throw new Error('No LOG_LEVELS found in .env file')
  }
  if (!PORT) {
    throw new Error('No PORT found in .env file')
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
      secret: 'my-secret',
      resave: false,
      saveUninitialized: false,
    }),
  )

  await app.listen(PORT)
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
