import {
  type AnnotationFeatureSnapshot,
  type CheckResultSnapshot,
} from '@apollo-annotation/mst'

export abstract class Check {
  abstract name: string
  abstract version: number
  abstract causes: string[]
  abstract isDefault: boolean

  abstract checkFeature(
    feature: AnnotationFeatureSnapshot,
    getSequence: (start: number, end: number) => Promise<string>,
  ): Promise<CheckResultSnapshot[]>
}
