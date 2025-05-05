import {
  Feature,
  FeatureDocument,
  FeatureSchema,
} from '@apollo-annotation/schemas'
import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
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
