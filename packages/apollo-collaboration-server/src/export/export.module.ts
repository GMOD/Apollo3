import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Export, ExportSchema } from 'apollo-schemas'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { FeaturesModule } from '../features/features.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { ExportController } from './export.controller'
import { ExportService } from './export.service'

@Module({
  imports: [
    AssembliesModule,
    FeaturesModule,
    MongooseModule.forFeature([{ name: Export.name, schema: ExportSchema }]),
    RefSeqsModule,
  ],
  providers: [ExportService],
  controllers: [ExportController],
})
export class ExportModule {}
