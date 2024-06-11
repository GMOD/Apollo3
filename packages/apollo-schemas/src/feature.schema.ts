import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { AnnotationFeatureSnapshotNew } from 'apollo-mst'
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose'

export interface FeatureDocument extends HydratedDocument<Feature> {
  createdAt?: Date
  updatedAt?: Date
}

@Schema({ timestamps: true })
export class Feature
  implements Omit<AnnotationFeatureSnapshotNew, '_id' | 'children' | 'refSeq'>
{
  // Don't make this a @Prop since _id is already on a MongoDB document
  _id: Types.ObjectId

  // Here we store feature ID if it's given in attributes, otherwise gffId = _id as string
  @Prop()
  gffId: string

  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
    ref: 'RefSeq',
  })
  refSeq: Types.ObjectId

  @Prop({ type: [String], required: true, index: true })
  allIds: string[]

  @Prop({ required: true })
  type: string

  @Prop({ required: true })
  min: number

  @Prop({ required: true })
  max: number

  @Prop()
  discontinuousLocations?: { start: number; end: number; phase?: 0 | 1 | 2 }[]

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

  @Prop()
  status: number

  @Prop()
  user: string
}
export const FeatureSchema = SchemaFactory.createForClass(Feature)

FeatureSchema.add({ children: { type: Map, of: FeatureSchema } })

FeatureSchema.index({ refSeq: 1, start: 1 })
FeatureSchema.index({ refSeq: 1, end: 1 })
FeatureSchema.index({ '$**': 'text' })
