import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
  type HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose'

export type AssemblyDocument = HydratedDocument<Assembly>

@Schema()
export class Assembly {
  @Prop({ required: true })
  name: string

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Check' }] })
  checks: Types.ObjectId[]
}

export const AssemblySchema = SchemaFactory.createForClass(Assembly)
