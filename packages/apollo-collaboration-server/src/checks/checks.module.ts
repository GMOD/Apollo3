/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { CheckResultSnapshot } from '@apollo-annotation/mst'
import {
  Check,
  CheckResult,
  type CheckResultDocument,
  CheckResultSchema,
  CheckSchema,
} from '@apollo-annotation/schemas'
import type { CheckResultUpdate } from '@apollo-annotation/shared'
import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

import { MessagesModule } from '../messages/messages.module.js'
import { MessagesService } from '../messages/messages.service.js'
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
        useFactory: (connection, messagesService: MessagesService) => {
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
            messagesService.broadcast(message.channel, message)
          }
          const broadcastDeletion = (doc: CheckResultDocument) => {
            const message: CheckResultUpdate = {
              channel: 'COMMON',
              userName: 'none',
              userSessionId: 'none',
              checkResult: doc.toJSON(),
              deleted: true,
            }
            messagesService.broadcast(message.channel, message)
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
          CheckResultSchema.pre('insertMany', (_result, checkResults) => {
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
        inject: [getConnectionToken(), MessagesService],
      },
      { name: Check.name, useFactory: () => CheckSchema },
    ]),
  ],

  exports: [ChecksService, MongooseModule],
  controllers: [ChecksController],
})
export class ChecksModule {}
