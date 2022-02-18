import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { FileHandlingService } from './fileHandling/fileHandling.service'

async function bootstrap() {
  const {
    CORS,
    LOGGER_OPTIONS,
    APPLICATION_PORT,
    GFF3_DEFAULT_FILENAME_AT_STARTUP,
  } = process.env
  if (!CORS) {
    throw new Error('No CORS found in .env file')
  }
  if (!LOGGER_OPTIONS) {
    throw new Error('No LOGGER_OPTIONS found in .env file')
  }
  if (!APPLICATION_PORT) {
    throw new Error('No APPLICATION_PORT found in .env file')
  }
  if (!GFF3_DEFAULT_FILENAME_AT_STARTUP) {
    throw new Error('No GFF3_DEFAULT_FILENAME_AT_STARTUP found in .env file')
  }
  const cors = convertToBoolean(CORS)
  const loggerOpions = JSON.parse(LOGGER_OPTIONS)
  const app = await NestFactory.create(AppModule, {
    logger: loggerOpions,
    cors,
  })
  await app.listen(APPLICATION_PORT)
  // eslint-disable-next-line no-console
  console.log(
    `Application is running on: ${await app.getUrl()}, CORS = ${cors}`,
  )

  // Load GFF3 file content into cache
  const appService = app.get(FileHandlingService)
  appService.loadGFF3FileIntoCache(GFF3_DEFAULT_FILENAME_AT_STARTUP)
}
bootstrap()

function convertToBoolean(input: string): boolean | undefined {
  try {
    return JSON.parse(input)
  } catch (e) {
    return undefined
  }
}
