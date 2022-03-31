import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

export type UserRoleDocument = UserRole & Document

@Schema()
export class UserRole {
  @Prop({ required: true })
  description: string

  @Prop({ required: true })
  active: boolean
}

export const UserRoleSchema = SchemaFactory.createForClass(UserRole)
