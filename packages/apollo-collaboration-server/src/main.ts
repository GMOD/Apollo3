import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { FileHandlingService } from './fileHandling/fileHandling.service'

async function bootstrap() {
  const cors = convertToBoolean(process.env.CORS)
  const loggerOpions = JSON.parse(process.env.LOGGER_OPTIONS)
  const app = await NestFactory.create(AppModule, {
    logger: loggerOpions,
    cors: cors,
  })
  await app.listen(process.env.APPLICATION_PORT)
  // eslint-disable-next-line no-console
  console.log(
    `Application is running on: ${await app.getUrl()}, CORS = ${cors}`,
  )

  // Load GFF3 file content into cache
  const appService = app.get(FileHandlingService)
  appService.loadGFF3FileIntoCache(process.env.GFF3_DEFAULT_FILENAME_AT_STARTUP)
}
bootstrap()

function convertToBoolean(input: string): boolean | undefined {
  try {
    return JSON.parse(input)
  } catch (e) {
    return undefined
  }
}
