/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { type CheckResultSnapshot } from '@apollo-annotation/mst'
import {
  Check,
  CheckResult,
  type CheckResultDocument,
  CheckResultSchema,
  CheckSchema,
} from '@apollo-annotation/schemas'
import { type CheckResultUpdate } from '@apollo-annotation/shared'
import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

import { MessagesGateway } from '../messages/messages.gateway.js'
import { MessagesModule } from '../messages/messages.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'
import { SequenceModule } from '../sequence/sequence.module.js'

import { ChecksController } from './checks.controller.js'
import { ChecksService } from './checks.service.js'

@Module({
  providers: [ChecksService],
  imports: [
    forwardRef(() => SequenceModule),
    MessagesModule,
    RefSeqsModule,
    MongooseModule.forFeatureAsync([
      {
        name: CheckResult.name,
        useFactory: (connection, messagesGateway: MessagesGateway) => {
          CheckResultSchema.plugin(idValidator, { connection })
          const broadcast = async (
            doc: CheckResultDocument | CheckResultSnapshot,
          ) => {
            const message: CheckResultUpdate = {
              channel: 'COMMON',
              userName: 'none',
              userSessionId: 'none',
              checkResult: 'toJSON' in doc ? doc.toJSON() : doc,
            }
            await messagesGateway.create(message.channel, message)
          }
          const broadcastDeletion = async (doc: CheckResultDocument) => {
            const message: CheckResultUpdate = {
              channel: 'COMMON',
              userName: 'none',
              userSessionId: 'none',
              checkResult: doc.toJSON(),
              deleted: true,
            }
            await messagesGateway.create(message.channel, message)
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
              await broadcast(checkResult)
            }
          })
          CheckResultSchema.pre(
            'insertMany',
            async function (_result, checkResults) {
              for (const checkResult of checkResults) {
                await broadcast(checkResult)
              }
            },
          )
          CheckResultSchema.pre('findOneAndDelete', async function () {
            const checkResults = await this.model.find<CheckResultDocument>(
              this.getQuery(),
            )
            for (const checkResult of checkResults) {
              await broadcastDeletion(checkResult)
            }
          })
          CheckResultSchema.pre('deleteMany', async function () {
            const checkResults = await this.model.find<CheckResultDocument>(
              this.getQuery(),
            )
            for (const checkResult of checkResults) {
              await broadcastDeletion(checkResult)
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

  exports: [ChecksService, MongooseModule],
  controllers: [ChecksController],
})
export class ChecksModule {}
