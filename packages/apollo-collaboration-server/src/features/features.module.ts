import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { Feature, FeatureSchema } from 'apollo-schemas'
import { Connection } from 'mongoose'
import idValidator from 'mongoose-id-validator'

import { ChecksModule } from '../checks/checks.module'
import { OperationsModule } from '../operations/operations.module'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { FeaturesController } from './features.controller'
import { FeaturesService } from './features.service'

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService],
  imports: [
    ChecksModule,
    forwardRef(() => OperationsModule),
    RefSeqChunksModule,
    RefSeqsModule,
    MongooseModule.forFeatureAsync([
      {
        name: Feature.name,
        useFactory: (connection: Connection) => {
          FeatureSchema.plugin(idValidator, { connection })
          return FeatureSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
  ],
  exports: [MongooseModule, FeaturesService],
})
export class FeaturesModule {}
