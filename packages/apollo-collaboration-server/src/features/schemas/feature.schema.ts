import { GFF3FeatureLineWithRefs } from '@gmod/gff'
// import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema } from 'mongoose'

// export type FeatureDocument = Feature & Document

// @Schema()
// export class Feature {}

// export const FeatureSchema = SchemaFactory.createForClass(Feature)

export const FeatureSchema = new Schema({
  refSeqId: { type: String, required: true },
  featureId: { type: [String], required: true },
  gff3FeatureLineWithRefs: { type: JSON, required: true },
})
export interface FeatureDocument extends GFF3FeatureLineWithRefs, Document {
  id: string
  refSeqId: string
  featureId: string[]
  gff3FeatureLineWithRefs: GFF3FeatureLineWithRefs
}
