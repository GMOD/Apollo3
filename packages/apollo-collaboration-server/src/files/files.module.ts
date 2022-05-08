import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserFile, UserFileSchema } from 'apollo-schemas'

import { FilesController } from './files.controller'
import { FilesService } from './files.service'

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  imports: [
    MongooseModule.forFeature([
      { name: UserFile.name, schema: UserFileSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class FilesModule {}
