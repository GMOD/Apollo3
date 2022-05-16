import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { File, FileSchema } from 'apollo-schemas'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { FeaturesModule } from '../features/features.module'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { FilesController } from './files.controller'
import { FilesService } from './files.service'

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  imports: [
    MongooseModule.forFeature([{ name: File.name, schema: FileSchema }]),
    FeaturesModule,
    AssembliesModule,
    RefSeqsModule,
    RefSeqChunksModule,
  ],
  exports: [MongooseModule],
})
export class FilesModule {}
