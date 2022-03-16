import { GFF3FeatureLineWithRefs, GFF3Item } from '@gmod/gff'
import * as mongoose from 'mongoose'

export interface GFF3FeatureLineWithRefsAndApolloId extends GFF3FeatureLineWithRefs {
  apollo_id: string
  GFF3FeatureLineWithRefs: GFF3FeatureLineWithRefs
}