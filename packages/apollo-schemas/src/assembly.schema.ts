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

  /**
   * The JBrowse config.json filename (from JBROWSE_CONFIG_FILES) this
   * assembly was loaded from. JBrowse only guarantees `name` is unique
   * within a single config file, so identity is scoped to (name, configId)
   * rather than name alone - see the unique index below.
   */
  @Prop({ required: true })
  configId: string

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Check' }] })
  checks: Types.ObjectId[]
}

export const AssemblySchema = SchemaFactory.createForClass(Assembly)
AssemblySchema.index({ name: 1, configId: 1 }, { unique: true })
