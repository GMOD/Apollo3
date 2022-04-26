import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'

import { Assembly } from './assembly.schema'

export type ChangeLogDocument = ChangeLog & Document

@Schema({ timestamps: true })
export class ChangeLog {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assembly',
    required: true,
    index: true,
  })
  assembly: Assembly

  @Prop({ required: true })
  typeName: string

  @Prop({ required: true, index: true })
  changedIds: string[] // featureIds

  @Prop({ type: JSON, required: true })
  changes: unknown // serialized change

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ChangeLog',
  })
  reverts: ChangeLog

  @Prop({ required: true, index: true })
  user: string
}

export const ChangeLogSchema = SchemaFactory.createForClass(ChangeLog)
