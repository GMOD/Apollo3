import type { Change } from '@apollo-annotation/common'
import {
  type ServerPostValidationContext,
  ServerValidation,
} from '@apollo-annotation/common/server'
import { Feature, type FeatureDocument } from '@apollo-annotation/schemas'
import {
  getPrintableId,
  isLocationEndChange,
  isLocationStartChange,
} from '@apollo-annotation/shared'

/** After a location change, checks that no child extends past its parent */
export class ParentChildValidation extends ServerValidation {
  name = 'ParentChildValidation'

  async postValidate(
    change: Change,
    { connection, session }: ServerPostValidationContext,
  ) {
    if (!(isLocationEndChange(change) || isLocationStartChange(change))) {
      return
    }
    const featureModel = connection.model<FeatureDocument>(Feature.name)
    const topLevelFeatures: FeatureDocument[] = []
    for (const { featureId } of change.changes) {
      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .session(session)
        .exec()
      if (!topLevelFeature) {
        throw new Error(
          `ERROR: The following featureId was not found in database ='${featureId}'`,
        )
      }
      if (!topLevelFeatures.some((f) => f._id.equals(topLevelFeature._id))) {
        topLevelFeatures.push(topLevelFeature)
      }
    }
    for (const topLevelFeature of topLevelFeatures) {
      const message = findChildOutsideParent(topLevelFeature)
      if (message) {
        return message
      }
    }
    return
  }
}

function findChildOutsideParent(feature: Feature): string | undefined {
  for (const [, childFeature] of feature.children ??
    new Map<string, Feature>()) {
    if (childFeature.max > feature.max || childFeature.min < feature.min) {
      return `Feature ${getPrintableId(childFeature)} exceeds the bounds of its parent, ${getPrintableId(feature)}`
    }
    const message = findChildOutsideParent(childFeature)
    if (message) {
      return message
    }
  }
  return
}
