import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export interface CheckDocument extends HydratedDocument<Check> {
  createdAt: Date
  updatedAt: Date
}

@Schema({ timestamps: true })
export class Check {
  // Don't make this a @Prop since _id is already on a MongoDB document
  _id: Types.ObjectId

  @Prop()
  name: string

  @Prop()
  default: boolean

  @Prop()
  version: number
}
export const CheckSchema = SchemaFactory.createForClass(Check)
