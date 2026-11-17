/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import type { FeatureNode } from './AnnotationFeatureData.js'
import {
  AssemblySpecificChange,
  type SerializedAssemblySpecificChange,
  isAssemblySpecificChange,
} from './AssemblySpecificChange.js'
import type { ChangeOptions } from './Change.js'

export interface SerializedFeatureChange
  extends SerializedAssemblySpecificChange {
  /** The IDs of features that were changed in this operation */
  changedIds: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isFeatureChange(thing: any): thing is FeatureChange {
  return (
    isAssemblySpecificChange(thing) &&
    (thing as FeatureChange).changedIds !== undefined
  )
}

export abstract class FeatureChange extends AssemblySpecificChange {
  changedIds: string[]

  constructor(json: SerializedFeatureChange, options?: ChangeOptions) {
    super(json, options)
    this.changedIds = json.changedIds
  }

  /**
   * Get children's feature ids
   * @param feature - parent feature
   * @returns
   */
  getChildFeatureIds(feature: FeatureNode): string[] {
    if (!feature.children) {
      return []
    }
    const featureIds = []
    const children =
      feature.children instanceof Map
        ? feature.children
        : new Map(Object.entries(feature.children))
    for (const [childFeatureId, childFeature] of children || new Map()) {
      featureIds.push(childFeatureId, ...this.getChildFeatureIds(childFeature))
    }
    return featureIds
  }
}
