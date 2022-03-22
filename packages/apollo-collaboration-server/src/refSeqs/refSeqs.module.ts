import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

import { RefSeqsController } from './refSeqs.controller'
import { RefSeqsService } from './refSeqs.service'
import { RefSeq, RefSeqSchema } from './schemas/refSeq.schema'

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: RefSeq.name,
        useFactory: (connection) => {
          RefSeqSchema.plugin(idValidator, { connection })
          return RefSeqSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
  ],
  controllers: [RefSeqsController],
  providers: [RefSeqsService],
})
export class RefSeqsModule {}
