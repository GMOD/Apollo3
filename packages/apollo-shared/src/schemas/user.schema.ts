import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'

import { UserRole } from './userRole.schema'

export type UserDocument = UserPermission & Document

@Schema()
export class UserPermission {
  @Prop({ required: true })
  userId: string

  @Prop({ required: true })
  name: string

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'UserRole',
    required: true,
  })
  userRole: UserRole

  @Prop({ required: true })
  active: boolean
}

export const UserPermissionSchema = SchemaFactory.createForClass(UserPermission)
