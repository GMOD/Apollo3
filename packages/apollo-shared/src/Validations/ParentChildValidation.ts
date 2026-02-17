/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import type { Change } from '@apollo-annotation/common'
import type { Feature, FeatureDocument } from '@apollo-annotation/schemas'
import type { ClientSession, Model } from 'mongoose'

import {
  type LocationEndChange,
  type LocationStartChange,
  isLocationEndChange,
  isLocationStartChange,
} from '../Changes/index.js'
import { getPrintableId } from '../util.js'

import { Validation, type ValidationResult } from './Validation.js'

export class ParentChildValidation extends Validation {
  name = 'ParentChildValidation' as const

  async backendPostValidate(
    change: Change,
    {
      featureModel,
      session,
    }: { session: ClientSession; featureModel: Model<FeatureDocument> },
  ): Promise<ValidationResult> {
    if (isLocationEndChange(change) || isLocationStartChange(change)) {
      return this.validateParentChildRelationships(change, {
        session,
        featureModel,
      })
    }
    return { validationName: this.name }
  }

  async validateParentChildRelationships(
    change: LocationEndChange | LocationStartChange,
    {
      featureModel,
      session,
    }: { session: ClientSession; featureModel: Model<FeatureDocument> },
  ): Promise<ValidationResult> {
    const topLevelFeatures: FeatureDocument[] = []
    for (const ch of change.changes) {
      const { featureId } = ch

      // Search correct feature
      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
        throw new Error(errMsg)
      }
      if (!topLevelFeatures.some((f) => f._id === topLevelFeature._id)) {
        topLevelFeatures.push(topLevelFeature)
      }
    }
    for (const topLevelFeature of topLevelFeatures) {
      try {
        this.checkChildFeatureBoundaries(topLevelFeature)
      } catch (error) {
        return { validationName: this.name, error: { message: String(error) } }
      }
    }
    return { validationName: this.name }
  }

  checkChildFeatureBoundaries(feature: Feature) {
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
      this.checkChildFeatureBoundaries(childFeature)
    }
  }
}
