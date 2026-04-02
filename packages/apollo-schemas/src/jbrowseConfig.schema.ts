import { Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type JBrowseConfigDocument = HydratedDocument<JBrowseConfig>

@Schema({ strict: false })
export class JBrowseConfig {}

export const JBrowseConfigSchema = SchemaFactory.createForClass(JBrowseConfig)
