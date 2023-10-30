import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { File, FileSchema } from 'apollo-schemas'

import { FilesController } from './files.controller'
import { FilesService } from './files.service'

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  imports: [
    MongooseModule.forFeature([{ name: File.name, schema: FileSchema }]),
  ],
  exports: [MongooseModule, FilesService],
})
export class FilesModule {}
