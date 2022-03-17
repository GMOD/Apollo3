import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type RefSeqDocument = RefSeq & Document

@Schema()
export class RefSeq {
  @Prop({ required: true, index: true })
  assemblyId: string

  @Prop({ required: true })
  description: string

  @Prop({ required: true })
  length: number
}

export const RefSeqSchema = SchemaFactory.createForClass(RefSeq)