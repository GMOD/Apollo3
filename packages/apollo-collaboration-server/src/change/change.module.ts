import { Module } from '@nestjs/common'
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose'
import { Assembly, AssemblySchema, Feature, FeatureSchema, RefSeq, RefSeqSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { ChangeController } from './change.controller'
import { ChangeService } from './change.service'

@Module({
  controllers: [ChangeController],
  providers: [ChangeService],
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
export class ChangeModule {}
