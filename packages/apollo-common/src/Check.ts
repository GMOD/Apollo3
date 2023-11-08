import { AnnotationFeatureSnapshot, CheckResultSnapshot } from 'apollo-mst'

export abstract class Check {
  abstract checkFeature(
    feature: AnnotationFeatureSnapshot,
    getSequence: (start: number, end: number) => Promise<string>,
  ): Promise<CheckResultSnapshot[]>
}
