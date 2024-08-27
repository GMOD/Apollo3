import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type UserDocument = User & Document

export type Role = 'readOnly' | 'admin' | 'user'

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  username: string

  @Prop({ required: true, unique: true })
  email: string

  @Prop({ type: String, enum: ['readOnly', 'admin', 'user', 'none'] })
  role: Role
}

export const UserSchema = SchemaFactory.createForClass(User)
