import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type AssemblyDocument = Assembly & Document

@Schema()
export class Assembly {
  @Prop({ required: true })
  name: string

  @Prop()
  description: string
}

export const AssemblySchema = SchemaFactory.createForClass(Assembly)
