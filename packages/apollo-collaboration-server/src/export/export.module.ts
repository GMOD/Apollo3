import { Export, ExportSchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { FeaturesModule } from '../features/features.module'
import { FilesModule } from '../files/files.module'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'

import { ExportController } from './export.controller'
import { ExportService } from './export.service'

@Module({
  imports: [
    AssembliesModule,
    FeaturesModule,
    FilesModule,
    MongooseModule.forFeature([{ name: Export.name, schema: ExportSchema }]),
    RefSeqsModule,
    RefSeqChunksModule,
  ],
  providers: [ExportService],
  controllers: [ExportController],
})
export class ExportModule {}
