import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type UserDocument = HydratedDocument<User>

export type Role = 'readOnly' | 'admin' | 'user' | 'none'

@Schema({ timestamps: true })
export class User {
  /**
   * Not set for users who have been pre-approved by an admin but have not
   * logged in yet
   */
  @Prop()
  username?: string

  @Prop({ required: true, unique: true })
  email: string

  @Prop({ type: String, enum: ['readOnly', 'admin', 'user', 'none'] })
  role: Role
}

export const UserSchema = SchemaFactory.createForClass(User)
