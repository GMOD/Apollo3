import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
  type HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose'

export type JBrowseAssemblyDocument = HydratedDocument<JBrowseAssembly>

@Schema()
export class JBrowseAssembly {
  @Prop({ required: true })
  name: string

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Check' }] })
  checks: Types.ObjectId[]
}

export const JBrowseAssemblySchema =
  SchemaFactory.createForClass(JBrowseAssembly)
