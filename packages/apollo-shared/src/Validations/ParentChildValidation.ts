import { Change } from 'apollo-common'
import { Feature, FeatureDocument } from 'apollo-schemas'
import { ClientSession, Model } from 'mongoose'

import {
  LocationEndChange,
  LocationStartChange,
  isLocationEndChange,
  isLocationStartChange,
} from '../Changes'
import { Validation, ValidationResult } from './Validation'

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
          `Feature "${childFeature._id}" exceeds the bounds of its parent, "${feature._id}"`,
        )
      }
      this.checkChildFeatureBoundaries(childFeature)
    }
  }
}
