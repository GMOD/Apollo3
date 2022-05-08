import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Assembly, AssemblySchema } from 'apollo-schemas'

import { FilesController } from './files.controller'
import { FilesService } from './files.service'

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  imports: [
    MongooseModule.forFeature([
      { name: Assembly.name, schema: AssemblySchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class FilesModule {}
