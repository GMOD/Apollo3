import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'

import { RefSeq } from './refSeq.schema'

export type RefSeqChunkDocument = RefSeqChunk & Document

@Schema()
export class RefSeqChunk {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'RefSeq',
    required: true,
    index: true,
  })
  refSeq: RefSeq

  @Prop({ required: true })
  n: number

  @Prop({ required: true })
  sequence: string
}

export const RefSeqChunkSchema = SchemaFactory.createForClass(RefSeqChunk)
