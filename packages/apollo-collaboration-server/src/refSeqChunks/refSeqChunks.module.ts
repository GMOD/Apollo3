import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { RefSeqChunk, RefSeqChunkSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { RefSeqChunksController } from './refSeqChunks.controller'
import { RefSeqChunksService } from './refSeqChunks.service'

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: RefSeqChunk.name,
        useFactory: (connection) => {
          RefSeqChunkSchema.plugin(idValidator, { connection })
          return RefSeqChunkSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
    forwardRef(() => RefSeqsModule),
  ],
  exports: [RefSeqChunksService],
  controllers: [RefSeqChunksController],
  providers: [RefSeqChunksService],
})
export class RefSeqChunksModule {}
