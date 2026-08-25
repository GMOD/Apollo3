import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
  type HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose'

export type RefSeqChunkDocument = HydratedDocument<RefSeqChunk>

@Schema()
export class RefSeqChunk {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'RefSeq',
    required: true,
    index: true,
  })
  refSeq: Types.ObjectId

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
