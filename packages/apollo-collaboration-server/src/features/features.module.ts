import {
  Feature,
  type FeatureDocument,
  FeatureSchema,
} from '@apollo-annotation/schemas'
import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { type Connection } from 'mongoose'
import idValidator from 'mongoose-id-validator'

import { ChecksModule } from '../checks/checks.module.js'
import { ChecksService } from '../checks/checks.service.js'
import { OperationsModule } from '../operations/operations.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'
import { SequenceModule } from '../sequence/sequence.module.js'

import { FeaturesController } from './features.controller.js'
import { FeaturesService } from './features.service.js'

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
          const runChecksOnDocument = async (doc: FeatureDocument) => {
            await checksService.checkFeatures([doc], false)
          }
          const runChecksOnDocuments = async (docs: FeatureDocument[]) => {
            await checksService.checkFeatures(docs, false)
          }
          FeatureSchema.post('save', runChecksOnDocument)
          FeatureSchema.post('updateOne', runChecksOnDocument)
          FeatureSchema.post('update', async function () {
            const features = await this.model.find<FeatureDocument>(
              this.getQuery(),
            )
            await runChecksOnDocuments(features)
          })
          FeatureSchema.post('findOneAndUpdate', async function () {
            const features = await this.model.find<FeatureDocument>(
              this.getQuery(),
            )
            await runChecksOnDocuments(features)
          })
          FeatureSchema.post('updateMany', async function () {
            const query = this.getQuery()
            if (query.$and && query.$and[0]) {
              delete query.$and[0].status
            }
            const features = await this.model.find<FeatureDocument>(query)
            await runChecksOnDocuments(features)
          })
          FeatureSchema.post('replaceOne', async function () {
            const features = await this.model.find<FeatureDocument>(
              this.getQuery(),
            )
            await runChecksOnDocuments(features)
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
