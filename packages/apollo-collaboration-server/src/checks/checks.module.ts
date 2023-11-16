import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import {
  Check,
  CheckResult,
  CheckResultDocument,
  CheckResultSchema,
  CheckSchema,
} from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

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
        useFactory: (connection, checksService: ChecksService) => {
          CheckResultSchema.plugin(idValidator, { connection })
          // eslint-disable-next-line unicorn/consistent-function-scoping
          const runChecksOnDocument = async (doc: CheckResultDocument) => {
            console.log(
              '************* BROADCAST CHANGERESULT CHANGE ******************',
              doc,
            )
            console.log(`CheckService: ${checksService}`) // ChecksService IS UNDEFINED AND CANNOT BE USED
            // GS & KS: Perhaps here we just call  "messagesGateway.create". 
            await checksService.broadcastCheckResult(doc, 'username comes here')
          }
          CheckResultSchema.post('findOneAndUpdate', async function () {
            const checkResults = await this.model.find<CheckResultDocument>(
              this.getQuery(),
            )
            for (const checkResult of checkResults) {
              await runChecksOnDocument(checkResult)
            }
          })
          return CheckResultSchema
        },
        inject: [getConnectionToken()],
      },
      { name: Check.name, useFactory: () => CheckSchema },
    ]),
  ],

  exports: [ChecksService],
  controllers: [ChecksController],
})
export class ChecksModule {}
