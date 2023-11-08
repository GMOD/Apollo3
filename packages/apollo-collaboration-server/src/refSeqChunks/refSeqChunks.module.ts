import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { RefSeqChunk, RefSeqChunkSchema } from 'apollo-schemas'
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
