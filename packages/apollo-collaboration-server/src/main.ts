import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { FileHandlingService } from './fileHandling/fileHandling.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Define in application level what you want to log
    // logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    logger: ['log', 'error', 'warn', 'debug'],
    // logger: ['log', 'error', 'warn'],
    // logger: ['error', 'warn'],
  })
  // const app = await NestFactory.create(AppModule);
  await app.listen(3999)
  // eslint-disable-next-line no-console
  console.log(`Application is running on: ${await app.getUrl()}`)

  // Load GFF3 file content into cache
  const appService = app.get(FileHandlingService)
  appService.loadGFF3FileIntoCache(process.env.GFF3_DEFAULT_FILENAME_AT_STARTUP)
}
bootstrap()
