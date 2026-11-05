import { Export, ExportSchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AssembliesModule } from '../assemblies/assemblies.module.js'
import { FeaturesModule } from '../features/features.module.js'
import { JBrowseConfigModule } from '../jbrowse/jbrowseConfig.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'

import { ExportController } from './export.controller.js'
import { ExportService } from './export.service.js'

@Module({
  imports: [
    AssembliesModule,
    FeaturesModule,
    JBrowseConfigModule,
    MongooseModule.forFeature([{ name: Export.name, schema: ExportSchema }]),
    RefSeqsModule,
  ],
  providers: [ExportService],
  controllers: [ExportController],
})
export class ExportModule {}
