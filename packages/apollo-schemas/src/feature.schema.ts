import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { AnnotationFeatureSnapshot } from 'apollo-mst'
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose'

import { RefSeq } from './refSeq.schema'

export type FeatureDocument = HydratedDocument<Feature>

@Schema()
export class Feature
  implements Omit<AnnotationFeatureSnapshot, '_id' | 'children'>
{
  // Don't make this a @Prop since _id is already on a MongoDB document
  _id: Types.ObjectId

  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
    ref: 'RefSeq',
  })
  refSeq: RefSeq

  @Prop({ type: [String], required: true, index: true })
  allIds: string[]

  @Prop({ required: true })
  refName: string

  @Prop({ required: true })
  type: string

  @Prop({ required: true })
  start: number

  @Prop({ required: true })
  end: number

  @Prop()
  discontinuousLocations?: { start: number; end: number }[]

  @Prop()
  strand?: 1 | -1

  @Prop()
  score?: number

  @Prop()
  phase?: 0 | 1 | 2

  @Prop({ type: Map, of: [String] })
  attributes?: Record<string, string[]>

  // This is not a @Prop because it needs to be a recursive reference to the
  // schema, which is done with Schema.add below
  children?: Map<string, Feature>
}
export const FeatureSchema = SchemaFactory.createForClass(Feature)

FeatureSchema.add({ children: { type: Map, of: FeatureSchema } })

FeatureSchema.index({ refSeq: 1, start: 1 })
FeatureSchema.index({ refSeq: 1, end: 1 })
