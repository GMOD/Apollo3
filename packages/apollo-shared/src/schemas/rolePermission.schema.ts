import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'

import { Permission } from './permission.schema'
import { UserRole } from './userRole.schema'

export type RolePermissionDocument = RolePermission & Document

@Schema()
export class RolePermission {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Permission',
    required: true,
  })
  permission: Permission

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'UserRole',
    required: true,
  })
  userRole: UserRole
}

export const RolePermissionSchema = SchemaFactory.createForClass(RolePermission)
