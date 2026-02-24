import { File, FileSchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { FilesController } from './files.controller.js'
import { FilesService } from './files.service.js'

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  imports: [
    MongooseModule.forFeature([{ name: File.name, schema: FileSchema }]),
  ],
  exports: [MongooseModule, FilesService],
})
export class FilesModule {}
