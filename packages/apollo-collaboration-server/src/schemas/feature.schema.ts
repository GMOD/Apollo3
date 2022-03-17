import { GFF3FeatureLineWithRefs } from '@gmod/gff'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type FeatureDocument = Feature & Document

@Schema()
export class Feature {
  @Prop({ required: true, index: true })
  refSeqId: string

  @Prop({ type: [String], required: true, index: true })
  featureId: string[]

  @Prop({ type: JSON, required: true })
  gff3FeatureLineWithRefs: GFF3FeatureLineWithRefs
}

export const FeatureSchema = SchemaFactory.createForClass(Feature)
