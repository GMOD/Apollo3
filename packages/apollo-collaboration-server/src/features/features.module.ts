import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { Feature, FeatureSchema } from 'apollo-schemas'
import { Connection } from 'mongoose'
import idValidator from 'mongoose-id-validator'

import { ChecksModule } from '../checks/checks.module'
import { ChecksService } from '../checks/checks.service'
import { OperationsModule } from '../operations/operations.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { SequenceModule } from '../sequence/sequence.module'
import { FeaturesController } from './features.controller'
import { FeaturesService } from './features.service'

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService],
  imports: [
    ChecksModule,
    forwardRef(() => OperationsModule),
    RefSeqsModule,
    SequenceModule,
    MongooseModule.forFeatureAsync([
      {
        name: Feature.name,
        useFactory: (connection: Connection, checksService: ChecksService) => {
          FeatureSchema.plugin(idValidator, { connection })
          FeatureSchema.post('save', async (doc) => {
            if (doc.allIds.length > 0 && doc.status === 0) {
              await checksService.clearChecksForFeature(doc)
              await checksService.checkFeature(doc)
            }
          })
          return FeatureSchema
        },
        imports: [ChecksModule],
        inject: [getConnectionToken(), ChecksService],
      },
    ]),
  ],
  exports: [MongooseModule, FeaturesService],
})
export class FeaturesModule {}
