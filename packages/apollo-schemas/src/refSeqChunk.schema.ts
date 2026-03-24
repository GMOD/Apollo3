import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { type HydratedDocument, Schema as MongooseSchema } from 'mongoose'

import { RefSeq } from './refSeq.schema.js'

export type RefSeqChunkDocument = HydratedDocument<RefSeqChunk>

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

  @Prop()
  status: number

  @Prop()
  user: string
}

export const RefSeqChunkSchema = SchemaFactory.createForClass(RefSeqChunk)
