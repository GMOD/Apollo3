import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
  type HydratedDocument,
  Schema as MongooseSchema,
  type Types,
} from 'mongoose'

export type GroupMembershipDocument = HydratedDocument<GroupMembership>

@Schema({ timestamps: true })
export class GroupMembership {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true,
  })
  groupId: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId

  @Prop()
  createdBy?: string

  @Prop()
  updatedBy?: string
}

export const GroupMembershipSchema =
  SchemaFactory.createForClass(GroupMembership)

GroupMembershipSchema.index({ groupId: 1, userId: 1 }, { unique: true })
