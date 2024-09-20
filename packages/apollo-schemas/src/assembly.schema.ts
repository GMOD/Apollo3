import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Schema as MongooseSchema, Types } from 'mongoose'

export type AssemblyDocument = Assembly & Document

@Schema()
export class Assembly {
  @Prop({ required: true })
  name: string

  @Prop()
  displayName: string

  @Prop({ type: [String] })
  aliases: string[]

  @Prop()
  description: string

  @Prop()
  status: number

  @Prop()
  user: string

  @Prop({ type: { fa: String, fai: String, gzi: String } })
  externalLocation: { fa: string; fai: string; gzi?: string }

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Check' }] })
  checks: Types.ObjectId[]

  @Prop()
  fileId: string
}

export const AssemblySchema = SchemaFactory.createForClass(Assembly)
