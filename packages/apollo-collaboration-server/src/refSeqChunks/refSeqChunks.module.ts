/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  RefSeqChunk,
  RefSeqChunkSchema,
} from '@apollo-annotation/apollo-schemas'
import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

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
  ],
  exports: [MongooseModule],
})
export class RefSeqChunksModule {}
