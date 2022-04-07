import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { Assembly, AssemblySchema } from 'apollo-schemas'
import { RefSeq, RefSeqSchema } from 'apollo-schemas'
import { Feature, FeatureSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { FeaturesController } from './features.controller'
import { FeaturesService } from './features.service'

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService],
  imports: [
    MongooseModule.forFeature([
      { name: Assembly.name, schema: AssemblySchema },
    ]),
    MongooseModule.forFeature([{ name: RefSeq.name, schema: RefSeqSchema }]),
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
})
export class FeaturesModule {}
