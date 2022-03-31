import { GFF3FeatureLineWithRefs } from '@gmod/gff'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'

import { RefSeq } from './refSeq.schema'

export type FeatureDocument = Feature & Document

@Schema()
export class Feature {
  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
    ref: 'RefSeq',
  })
  refSeqId: RefSeq

  @Prop({ type: [String], required: true, index: true })
  featureId: string[]

  @Prop({ type: JSON, required: true })
  gff3FeatureLineWithRefs: GFF3FeatureLineWithRefs
}

export const FeatureSchema = SchemaFactory.createForClass(Feature)
