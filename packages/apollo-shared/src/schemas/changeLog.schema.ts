import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type ChangeLogDocument = ChangeLog & Document

@Schema()
export class ChangeLog {
  @Prop({ required: true, index: true })
  assemblyId: string

  @Prop({ required: true, index: true })
  featureId: string

  @Prop({ required: true })
  objectType: string

  @Prop({ type: JSON, required: true })
  changeObject: JSON

  @Prop({ required: true })
  userId: string

  @Prop({ required: true, default: Date.now })
  timeStamp: Date
}

export const ChangeLogSchema = SchemaFactory.createForClass(ChangeLog)
