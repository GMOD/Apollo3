import { AnnotationFeatureSnapshot, CheckResultSnapshot } from 'apollo-mst'

export abstract class Check {
  abstract checkFeature(
    feature: AnnotationFeatureSnapshot,
    sequence: string,
  ): Promise<CheckResultSnapshot | undefined>
}
