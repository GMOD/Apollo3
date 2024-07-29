import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type JBrowseConfigDocument = JBrowseConfig & Document

@Schema({ strict: false })
export class JBrowseConfig {}

export const JBrowseConfigSchema = SchemaFactory.createForClass(JBrowseConfig)
