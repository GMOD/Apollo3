import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type FileDocument = File & Document

@Schema({ timestamps: true })
export class File {
  @Prop({ required: true })
  basename: string

  @Prop({ required: true })
  checksum: string

  @Prop({ required: true })
  type: string

  @Prop({ required: true })
  user: string
}

export const FileSchema = SchemaFactory.createForClass(File)
