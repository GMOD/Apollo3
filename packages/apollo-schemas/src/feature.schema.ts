import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose'

export interface FeatureDocument extends HydratedDocument<Feature> {
  createdAt?: Date
  updatedAt?: Date
}

@Schema({ timestamps: true })
export class Feature
  implements Omit<AnnotationFeatureSnapshot, '_id' | 'children' | 'refSeq'>
{
  // Don't make this a @Prop since _id is already on a MongoDB document
  _id: Types.ObjectId

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
  strand?: 1 | -1

  @Prop({ type: Map, of: [String] })
  attributes?: Record<string, string[]>

  // This is not a @Prop because it needs to be a recursive reference to the
  // schema, which is done with Schema.add below
  children?: Map<string, Feature>

  @Prop()
  status: number

  @Prop()
  user: string

  @Prop({ type: [String], index: true, sparse: true })
  allExternalIds?: string[]
}
export const FeatureSchema = SchemaFactory.createForClass(Feature)

FeatureSchema.add({ children: { type: Map, of: FeatureSchema } })

FeatureSchema.index({ refSeq: 1, min: 1 })
FeatureSchema.index({ refSeq: 1, max: 1 })
FeatureSchema.index({ '$**': 'text' })
