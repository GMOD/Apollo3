/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import type { Feature } from '@apollo-annotation/schemas'

import { getPrintableId } from '../util.js'

import { Validation } from './Validation.js'

/**
 * Recursively checks that no child feature's bounds exceed its parent's.
 * Pure/in-memory: callers that mutate a feature tree should run this against
 * the in-memory result before saving, since there is no transaction to roll
 * back a save that fails this check afterward.
 */
export function checkChildFeatureBoundaries(feature: Feature) {
  if (!feature.children) {
    return
  }
  for (const [, childFeature] of feature.children || new Map()) {
    if (
      feature.min !== null &&
      feature.max !== null &&
      childFeature.min !== null &&
      childFeature.max !== null &&
      (childFeature.max > feature.max || childFeature.min < feature.min)
    ) {
      throw new Error(
        `Feature ${getPrintableId(childFeature)} exceeds the bounds of its parent, ${getPrintableId(feature)}`,
      )
    }
    checkChildFeatureBoundaries(childFeature)
  }
}

export class ParentChildValidation extends Validation {
  name = 'ParentChildValidation' as const
}
