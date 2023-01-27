import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'

export type ChangeDocument = Change & Document

@Schema({ timestamps: true })
export class Change {
  @Prop({ type: MongooseSchema.Types.ObjectId }) // We cannot use FK anymore because assembly is deleted outside of transaction concept
  assembly: MongooseSchema.Types.ObjectId

  @Prop({ required: true })
  typeName: string

  @Prop({ required: true, index: true })
  changedIds: string[] // featureIds

  @Prop({ type: JSON })
  changes: unknown // serialized change

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Change',
  })
  reverts: Change

  @Prop({ required: true, index: true })
  user: string

  @Prop()
  sequence: number
}

export const ChangeSchema = SchemaFactory.createForClass(Change)
