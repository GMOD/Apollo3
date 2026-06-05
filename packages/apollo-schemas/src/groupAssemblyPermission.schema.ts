import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
  type HydratedDocument,
  Schema as MongooseSchema,
  type Types,
} from 'mongoose'

export type GroupAssemblyPermissionDocument =
  HydratedDocument<GroupAssemblyPermission>

@Schema({ timestamps: true })
export class GroupAssemblyPermission {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true,
  })
  groupId: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assembly',
    required: true,
    index: true,
  })
  assemblyId: Types.ObjectId

  @Prop({ required: true, default: false })
  canViewAnnotations: boolean

  @Prop({ required: true, default: false })
  canEditAnnotations: boolean

  @Prop()
  createdBy?: string

  @Prop()
  updatedBy?: string
}

export const GroupAssemblyPermissionSchema = SchemaFactory.createForClass(
  GroupAssemblyPermission,
)

GroupAssemblyPermissionSchema.index(
  { groupId: 1, assemblyId: 1 },
  { unique: true },
)

GroupAssemblyPermissionSchema.pre('validate', function onValidate(next) {
  if (this.canEditAnnotations) {
    this.canViewAnnotations = true
  }
  next()
})
