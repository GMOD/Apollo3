import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { CheckResult, CheckResultSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { ChecksController } from './checks.controller'
import { ChecksService } from './checks.service'

@Module({
  providers: [ChecksService],
  imports: [
    RefSeqsModule,
    MongooseModule.forFeatureAsync([
      {
        name: CheckResult.name,
        useFactory: (connection) => {
          CheckResultSchema.plugin(idValidator, { connection })
          return CheckResultSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
  ],

  exports: [ChecksService],
  controllers: [ChecksController],
})
export class ChecksModule {}