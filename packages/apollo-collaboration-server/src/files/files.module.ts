import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { File, FileSchema } from 'apollo-schemas'

import { FeaturesModule } from '../features/features.module'
import { FilesController } from './files.controller'
import { FilesService } from './files.service'

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  imports: [
    MongooseModule.forFeature([{ name: File.name, schema: FileSchema }]),
    FeaturesModule,
  ],
  exports: [MongooseModule],
})
export class FilesModule {}
