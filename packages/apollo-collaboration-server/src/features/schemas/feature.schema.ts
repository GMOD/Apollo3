import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type FeatureDocument = Feature & Document

@Schema()
export class Feature {}

export const FeatureSchema = SchemaFactory.createForClass(Feature)
