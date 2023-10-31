import { AnnotationFeatureSnapshot } from 'apollo-mst/src/AnnotationFeature'
import { CheckResultSnapshot } from 'apollo-mst/src/CheckResult'

export abstract class Check {
  abstract checkFeature(
    feature: AnnotationFeatureSnapshot,
    sequence: string,
  ): Promise<CheckResultSnapshot>
}
