import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type GroupDocument = HydratedDocument<Group>

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true, unique: true, trim: true })
  name: string

  @Prop({ trim: true })
  description?: string

  @Prop()
  createdBy?: string

  @Prop()
  updatedBy?: string
}

export const GroupSchema = SchemaFactory.createForClass(Group)
