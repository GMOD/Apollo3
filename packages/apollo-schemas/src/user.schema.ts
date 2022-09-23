import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type UserDocument = User & Document

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  id: string

  @Prop({ required: true, unique: true })
  username: string

  @Prop({ required: true, unique: true })
  email: string

  @Prop({ required: true, type: [String], enum: ['readOnly', 'admin', 'user'] })
  role: [{ type: string }]
}

export const UserSchema = SchemaFactory.createForClass(User)
