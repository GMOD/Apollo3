import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema, Types } from 'mongoose'

import { Assembly } from './assembly.schema.js'

export type RefSeqDocument = RefSeq & Document

@Schema()
export class RefSeq {
  // Don't make this a @Prop since _id is already on a MongoDB document
  _id: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assembly',
    required: true,
    index: true,
  })
  assembly: Assembly

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
