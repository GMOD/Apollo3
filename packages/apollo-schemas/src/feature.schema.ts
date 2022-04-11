import { GFF3Feature, GFF3FeatureLineWithRefs } from '@gmod/gff'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'

import { RefSeq } from './refSeq.schema'

export type FeatureDocument = Feature & Document

@Schema()
export class Feature implements GFF3FeatureLineWithRefs {
  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
    ref: 'RefSeq',
  })
  refSeq: RefSeq

  @Prop({ type: [String], required: true, index: true })
  featureIds: string[]

  @Prop({ type: String, required: true, index: true })
  featureId: string

  @Prop({ required: true })
  // eslint-disable-next-line camelcase
  seq_id: string

  @Prop()
  source: string

  @Prop({ required: true })
  type: string

  @Prop({ required: true })
  start: number

  @Prop({ required: true })
  end: number

  @Prop()
  score: number

  @Prop()
  strand: string

  @Prop()
  phase: string

  @Prop({ type: Map, of: [String] })
  attributes: Record<string, string[]>

  @Prop({ type: JSON })
  // eslint-disable-next-line camelcase
  child_features: GFF3Feature[]

  @Prop({ type: JSON })
  // eslint-disable-next-line camelcase
  derived_features: GFF3Feature[]
}
export const FeatureSchema = SchemaFactory.createForClass(Feature)

FeatureSchema.index({ refSeq: 1, start: 1 })
FeatureSchema.index({ refSeq: 1, end: 1 })
