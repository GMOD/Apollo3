import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { Feature, FeatureSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { FeaturesController } from './features.controller'
import { FeaturesService } from './features.service'

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService],
  imports: [
    AssembliesModule,
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
    ]),
  ],
  exports: [MongooseModule],
})
export class FeaturesModule {}
