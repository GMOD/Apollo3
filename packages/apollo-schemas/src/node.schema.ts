import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import mongoose, { Types } from 'mongoose'

export type NodeDocument = Node & Document

@Schema()
export class Node {
  // Don't make this a @Prop since _id is already on a MongoDB document
  _id: Types.ObjectId

  @Prop({ required: true })
  id: mongoose.Schema.Types.Mixed

  @Prop()
  meta: mongoose.Schema.Types.Mixed

  @Prop()
  name: mongoose.Schema.Types.Mixed

  @Prop()
  property1: mongoose.Schema.Types.Mixed

  @Prop()
  type: mongoose.Schema.Types.Mixed
}
export const NodeSchema = SchemaFactory.createForClass(Node)

NodeSchema.index({ id: 1 })
