import { HttpAdapterHost, NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { GlobalExceptionsFilter } from './global-exceptions.filter'

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
  const cors = convertToBoolean(CORS)
  const loggerOpions = JSON.parse(LOGGER_OPTIONS)
  const app = await NestFactory.create(AppModule, {
    logger: loggerOpions,
    cors,
  })
  const { httpAdapter } = app.get(HttpAdapterHost)
  app.useGlobalFilters(new GlobalExceptionsFilter(httpAdapter))
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
