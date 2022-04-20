import { GFF3Feature, GFF3FeatureLine } from '@gmod/gff'

import { Change } from './Change'

interface GFF3FeatureLineWithOptionalRefs extends GFF3FeatureLine {
  // eslint-disable-next-line camelcase
  child_features?: GFF3Feature[]
  // eslint-disable-next-line camelcase
  derived_features?: GFF3Feature[]
}

export interface GFF3FeatureLineWithFeatureIdAndOptionalRefs
  extends GFF3FeatureLineWithOptionalRefs {
  featureId: string
}

export abstract class FeatureChange extends Change {
  /**
   * Get single feature by featureId
   * @param featureObject -
   * @param featureId -
   * @returns
   */
  getObjectByFeatureId(
    feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
    featureId: string,
  ): GFF3FeatureLineWithFeatureIdAndOptionalRefs | null {
    console.debug(`Entry=${JSON.stringify(feature)}`)

    console.debug(`Top level featureId=${feature.featureId}`)
    if (feature.featureId === featureId) {
      console.debug(
        `Top level featureId matches in object ${JSON.stringify(feature)}`,
      )
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    console.debug(
      `FeatureId was not found on top level so lets make recursive call...`,
    )
    for (const childFeature of feature.child_features || []) {
      for (const childFeatureLine of childFeature) {
        const subFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs | null =
          this.getObjectByFeatureId(
            childFeatureLine as GFF3FeatureLineWithFeatureIdAndOptionalRefs,
            featureId,
          )
        if (subFeature) {
          return subFeature
        }
      }
    }
    return null
  }
}
