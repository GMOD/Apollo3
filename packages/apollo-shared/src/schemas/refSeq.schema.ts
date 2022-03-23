import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'

import { Assembly } from './assembly.schema'

export type RefSeqDocument = RefSeq & Document

@Schema()
export class RefSeq {
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

  @Prop({ required: true })
  length: number
}

export const RefSeqSchema = SchemaFactory.createForClass(RefSeq)
