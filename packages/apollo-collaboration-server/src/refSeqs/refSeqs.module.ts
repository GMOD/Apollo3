/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { RefSeq, RefSeqSchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

import { RefSeqsController } from './refSeqs.controller.js'
import { RefSeqsService } from './refSeqs.service.js'

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
  exports: [MongooseModule, RefSeqsService],
  controllers: [RefSeqsController],
  providers: [RefSeqsService],
})
export class RefSeqsModule {}
