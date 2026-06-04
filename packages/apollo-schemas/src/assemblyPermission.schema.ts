import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
  type HydratedDocument,
  Schema as MongooseSchema,
  type Types,
} from 'mongoose'

export type AssemblyPermissionDocument = HydratedDocument<AssemblyPermission>

@Schema({ timestamps: true })
export class AssemblyPermission {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId

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

export const AssemblyPermissionSchema =
  SchemaFactory.createForClass(AssemblyPermission)

AssemblyPermissionSchema.index({ userId: 1, assemblyId: 1 }, { unique: true })

AssemblyPermissionSchema.pre('validate', function onValidate(next) {
  if (this.canEditAnnotations) {
    this.canViewAnnotations = true
  }
  next()
})
