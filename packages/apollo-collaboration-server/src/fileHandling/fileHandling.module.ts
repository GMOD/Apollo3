import { Module } from '@nestjs/common'
import { FileHandlingController } from './fileHandling.controller'
import { FileHandlingService } from './fileHandling.service'

@Module({
  controllers: [FileHandlingController],
  providers: [FileHandlingService],
})
export class FileHandlingModule {}
