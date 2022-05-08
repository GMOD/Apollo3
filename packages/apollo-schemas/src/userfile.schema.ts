import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type UserFileDocument = UserFile & Document

@Schema({ timestamps: true })
export class UserFile {
  @Prop({ required: true })
  basename: string

  @Prop({ required: true })
  checksum: string

  @Prop({ required: true })
  type: string

  @Prop({ required: true })
  user: string
}

export const UserFileSchema = SchemaFactory.createForClass(UserFile)
