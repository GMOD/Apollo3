import { Module } from '@nestjs/common'
import { FileHandlingController } from './file-handling.controller'
import { FileHandlingService } from './file-handling.service'

@Module({
  controllers: [FileHandlingController],
  providers: [FileHandlingService],
})
export class FileHandlingModule {}
