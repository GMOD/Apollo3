import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
  type HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose'

export type RefSeqDocument = HydratedDocument<RefSeq>

@Schema()
export class RefSeq {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assembly',
    required: true,
    index: true,
  })
  assembly: Types.ObjectId

  @Prop({ required: true })
  name: string

  @Prop()
  description: string

  @Prop()
  aliases: string[]

  @Prop({ required: true })
  length: number

  @Prop({ default: 256 * 1024 /* 256 KiB */ })
  chunkSize: number

  @Prop()
  status: number

  @Prop()
  user: string
}

export const RefSeqSchema = SchemaFactory.createForClass(RefSeq)
