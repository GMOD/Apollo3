import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { RefSeq, RefSeqSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module'
import { RefSeqsController } from './refSeqs.controller'
import { RefSeqsService } from './refSeqs.service'

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
    RefSeqChunksModule,
  ],
  controllers: [RefSeqsController],
  providers: [RefSeqsService],
})
export class RefSeqsModule {}
