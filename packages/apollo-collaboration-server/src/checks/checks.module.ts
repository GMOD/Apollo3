/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { CheckResultSnapshot } from 'apollo-mst'
import {
  Check,
  CheckResult,
  CheckResultDocument,
  CheckResultSchema,
  CheckSchema,
} from 'apollo-schemas'
import { CheckResultUpdate } from 'apollo-shared'
import idValidator from 'mongoose-id-validator'

import { MessagesGateway } from '../messages/messages.gateway'
import { MessagesModule } from '../messages/messages.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { ChecksController } from './checks.controller'
import { ChecksService } from './checks.service'

@Module({
  providers: [ChecksService],
  imports: [
    MessagesModule,
    RefSeqsModule,
    MongooseModule.forFeatureAsync([
      {
        name: CheckResult.name,
        useFactory: (connection, messagesGateway: MessagesGateway) => {
          CheckResultSchema.plugin(idValidator, { connection })
          const broadcast = (
            doc: CheckResultDocument | CheckResultSnapshot,
          ) => {
            const message: CheckResultUpdate = {
              channel: 'COMMON',
              userName: 'none',
              userSessionId: 'none',
              checkResult: 'toJSON' in doc ? doc.toJSON() : doc,
            }
            messagesGateway.create(message.channel, message)
          }
          const broadcastDeletion = (doc: CheckResultDocument) => {
            const message: CheckResultUpdate = {
              channel: 'COMMON',
              userName: 'none',
              userSessionId: 'none',
              checkResult: doc.toJSON(),
              deleted: true,
            }
            messagesGateway.create(message.channel, message)
          }
          CheckResultSchema.post('save', broadcast)
          CheckResultSchema.post('updateOne', broadcast)
          CheckResultSchema.post('remove', broadcastDeletion)
          CheckResultSchema.post('deleteOne', broadcastDeletion)
          CheckResultSchema.pre('findOneAndUpdate', async function () {
            const checkResults = await this.model.find<CheckResultDocument>(
              this.getQuery(),
            )
            for (const checkResult of checkResults) {
              broadcast(checkResult)
            }
          })
          CheckResultSchema.pre('insertMany', function (_result, checkResults) {
            for (const checkResult of checkResults) {
              broadcast(checkResult)
            }
          })
          CheckResultSchema.pre('findOneAndDelete', async function () {
            const checkResults = await this.model.find<CheckResultDocument>(
              this.getQuery(),
            )
            for (const checkResult of checkResults) {
              broadcastDeletion(checkResult)
            }
          })
          CheckResultSchema.pre('deleteMany', async function () {
            const checkResults = await this.model.find<CheckResultDocument>(
              this.getQuery(),
            )
            for (const checkResult of checkResults) {
              broadcastDeletion(checkResult)
            }
          })
          return CheckResultSchema
        },
        imports: [MessagesModule],
        inject: [getConnectionToken(), MessagesGateway],
      },
      { name: Check.name, useFactory: () => CheckSchema },
    ]),
  ],

  exports: [ChecksService],
  controllers: [ChecksController],
})
export class ChecksModule {}
