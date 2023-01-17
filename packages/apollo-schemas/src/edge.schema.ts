import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import mongoose, { Types } from 'mongoose'

export type EdgeDocument = Edge & Document

@Schema()
export class Edge {
  // Don't make this a @Prop since _id is already on a MongoDB document
  _id: Types.ObjectId

  @Prop({ required: true })
  obj: mongoose.Schema.Types.Mixed

  @Prop()
  pred: mongoose.Schema.Types.Mixed

  @Prop()
  property1: mongoose.Schema.Types.Mixed

  @Prop()
  source: mongoose.Schema.Types.Mixed

  @Prop()
  sub: mongoose.Schema.Types.Mixed

  @Prop()
  target: mongoose.Schema.Types.Mixed
}
export const EdgeSchema = SchemaFactory.createForClass(Edge)

EdgeSchema.index({ sub: 1 })
