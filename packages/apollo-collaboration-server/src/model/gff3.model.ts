import { GFF3FeatureLineWithRefs } from '@gmod/gff'

export interface GFF3FeatureLineWithRefsAndFeatureId
  extends GFF3FeatureLineWithRefs {
  featureId: string
}

export class AssemblyIdDto {
  assemblyId: string
}
