import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type PermissionDocument = Permission & Document

@Schema()
export class Permission {
  @Prop({ required: true })
  description: string

  @Prop({ required: true })
  active: boolean
}

export const PermissionSchema = SchemaFactory.createForClass(Permission)
