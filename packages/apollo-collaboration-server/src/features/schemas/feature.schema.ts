import { GFF3FeatureLineWithRefs } from '@gmod/gff'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import * as mongoose from 'mongoose'

import { RefSeq } from '../../refseqs/schemas/refSeq.schema'

export type FeatureDocument = Feature & Document

@Schema()
export class Feature {
  @Prop({
    required: true,
    index: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RefSeq',
  })
  refSeqId: RefSeq

  @Prop({ type: [String], required: true, index: true })
  featureId: string[]

  @Prop({ type: JSON, required: true })
  gff3FeatureLineWithRefs: GFF3FeatureLineWithRefs
}

export const FeatureSchema = SchemaFactory.createForClass(Feature)
