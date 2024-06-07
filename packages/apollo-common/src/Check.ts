import {
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/apollo-mst'

export abstract class Check {
  abstract name: string
  abstract version: number

  abstract checkFeature(
    feature: AnnotationFeatureSnapshot,
    getSequence: (start: number, end: number) => Promise<string>,
  ): Promise<CheckResultSnapshot[]>
}
