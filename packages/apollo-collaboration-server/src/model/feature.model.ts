import { GFF3FeatureLineWithRefs } from '@gmod/gff'
import * as mongoose from 'mongoose'

// RefSeqChunk ??? - do we need this in db? If yes, when and how to load data in?

// Feature
export const FeatureSchema = new mongoose.Schema({
  refSeqId: { type: String, required: true },
  featureId: { type: [String], required: true },
  gff3FeatureLineWithRefs: { type: JSON, required: true },
})
export interface FeatureModel
  extends GFF3FeatureLineWithRefs,
    mongoose.Document {
  id: string
  refSeqId: string
  featureId: string[]
  gff3FeatureLineWithRefs: GFF3FeatureLineWithRefs
}
