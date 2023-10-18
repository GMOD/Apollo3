import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { Export, ExportSchema, Feature, FeatureSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { OperationsModule } from '../operations/operations.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { FeaturesController } from './features.controller'
import { FeaturesService } from './features.service'

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService],
  imports: [
    // AssembliesModule,
    // forwardRef(() => AssembliesModule), //We need this only to get assembly friendly name for exported GFF3 file
    forwardRef(() => OperationsModule),
    RefSeqsModule,
    MongooseModule.forFeatureAsync([
      {
        name: Feature.name,
        useFactory: (connection) => {
          FeatureSchema.plugin(idValidator, { connection })
          return FeatureSchema
        },
        inject: [getConnectionToken()],
      },
      { name: Export.name, useFactory: () => ExportSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class FeaturesModule {}
