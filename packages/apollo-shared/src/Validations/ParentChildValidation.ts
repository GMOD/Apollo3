import { FeatureDocument } from 'apollo-schemas'
import { ClientSession, Model } from 'mongoose'

import { Change } from '../ChangeManager/Change'
import { GFF3FeatureLineWithFeatureIdAndOptionalRefs } from '../ChangeManager/FeatureChange'
import { Validation, ValidationResult } from './Validation'
import {
  LocationEndChange,
  LocationStartChange,
  isLocationEndChange,
  isLocationStartChange,
} from '..'

export class ParentChildValidation extends Validation {
  name = 'ParentChildValidation' as const

  async backendPostValidate(
    change: Change,
    {
      session,
      featureModel,
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
      session,
      featureModel,
    }: { session: ClientSession; featureModel: Model<FeatureDocument> },
  ): Promise<ValidationResult> {
    const topLevelFeatures: FeatureDocument[] = []
    for (const ch of change.changes) {
      const { featureId } = ch

      // Search correct feature
      const topLevelFeature = await featureModel
        .findOne({ featureIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
        throw new Error(errMsg)
      }
      if (!topLevelFeatures.find((f) => f._id === topLevelFeature._id)) {
        topLevelFeatures.push(topLevelFeature)
      }
    }
    for (const topLevelFeature of topLevelFeatures) {
      try {
        this.checkChildFeatureBoundaries(
          topLevelFeature as GFF3FeatureLineWithFeatureIdAndOptionalRefs,
        )
      } catch (error) {
        return { validationName: this.name, error: { message: String(error) } }
      }
    }
    return { validationName: this.name }
  }

  checkChildFeatureBoundaries(
    feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
  ) {
    if (!feature.child_features) {
      return
    }
    feature.child_features.forEach((childFeature) => {
      childFeature.forEach((featureLocation) => {
        if (
          feature.start !== null &&
          feature.end !== null &&
          featureLocation.start !== null &&
          featureLocation.end !== null &&
          (featureLocation.end > feature.end ||
            featureLocation.start < feature.start)
        ) {
          throw new Error(
            `Feature "${
              (featureLocation as GFF3FeatureLineWithFeatureIdAndOptionalRefs)
                .featureId
            }" exceeds the bounds of its parent, "${feature.featureId}"`,
          )
        }
        this.checkChildFeatureBoundaries(
          featureLocation as GFF3FeatureLineWithFeatureIdAndOptionalRefs,
        )
      })
    })
  }
}
