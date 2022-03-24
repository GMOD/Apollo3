import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, model } from 'mongoose'

export type AssemblyDocument = Assembly & Document

@Schema()
export class Assembly {
  @Prop({ required: true })
  name: string

  @Prop()
  description: string
}

export const AssemblySchema = SchemaFactory.createForClass(Assembly)
const module1 = model('Assembly', AssemblySchema)
