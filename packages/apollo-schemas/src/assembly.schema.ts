import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Schema as MongooseSchema, Types } from 'mongoose'

import { File } from './file.schema'

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

  @Prop({
    type: {
      fa: { type: MongooseSchema.Types.ObjectId, ref: 'File' },
      fai: { type: MongooseSchema.Types.ObjectId, ref: 'File' },
      gzi: { type: MongooseSchema.Types.ObjectId, ref: 'File' },
    },
  })
  fileIds: { fa: string; fai: string; gzi: string } // Store fileId of fa/fai/gzi.

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Check' }] })
  checks: Types.ObjectId[]

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'File' })
  file: File
}

export const AssemblySchema = SchemaFactory.createForClass(Assembly)
