/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  type ChangeOptions,
  type ClientDataStore,
  FeatureChange,
  type LocalGFF3DataStore,
  type SerializedFeatureChange,
  type ServerDataStore,
} from '@apollo-annotation/common'
import type { Feature, FeatureDocument } from '@apollo-annotation/schemas'

interface SerializedLocationStartChangeBase extends SerializedFeatureChange {
  typeName: 'LocationStartChange'
}

interface LocationStartChangeDetails {
  featureId: string
  oldStart: number
  newStart: number
}

interface SerializedLocationStartChangeSingle
  extends SerializedLocationStartChangeBase,
    LocationStartChangeDetails {}

interface SerializedLocationStartChangeMultiple
  extends SerializedLocationStartChangeBase {
  changes: LocationStartChangeDetails[]
}

export type SerializedLocationStartChange =
  | SerializedLocationStartChangeSingle
  | SerializedLocationStartChangeMultiple

export class LocationStartChange extends FeatureChange {
  typeName = 'LocationStartChange' as const
  changes: LocationStartChangeDetails[]

  constructor(json: SerializedLocationStartChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedLocationStartChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ featureId, newStart, oldStart }] = changes
      return { typeName, changedIds, assembly, featureId, oldStart, newStart }
    }
    return { typeName, changedIds, assembly, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this
    // Let's first check that all features are found and those old values match with expected ones. We do this just to be sure that all changes can be done.
    const topLevelFeatures: FeatureDocument[] = []
    for (const change of changes) {
      const { featureId, oldStart, newStart } = change

      // See if we already have top-level feature for this feature
      let topLevelFeature: FeatureDocument | undefined | null
      let feature: Feature | undefined | null
      for (const tlv of topLevelFeatures) {
        const childFeature = this.getFeatureFromId(tlv, featureId)
        if (childFeature) {
          topLevelFeature = tlv
          feature = childFeature
          break
        }
      }
      if (!topLevelFeature) {
        // Don't already have top-level feature, so let's query it
        topLevelFeature = await featureModel
          .findOne({ allIds: featureId })
          .session(session)
          .exec()
        if (topLevelFeature) {
          topLevelFeatures.push(topLevelFeature)
        }
      }

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        logger.error(errMsg)
        throw new Error(errMsg)
        // throw new NotFoundException(errMsg)  -- This is causing runtime error because Exception comes from @nestjs/common!!!
      }
      logger.debug?.(
        `*** TOP level feature found: ${JSON.stringify(topLevelFeature)}`,
      )

      if (!feature) {
        feature = this.getFeatureFromId(topLevelFeature, featureId)
      }
      if (!feature) {
        const errMsg = 'ERROR when searching feature by featureId'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      logger.debug?.(`*** Found feature: ${JSON.stringify(feature)}`)
      if (feature.min !== oldStart) {
        const errMsg = 'Expected previous max does not match'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      feature.min = newStart
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('start') // Mark as modified. Without this save() -method is not updating data in database
      } else {
        topLevelFeature.markModified('children') // Mark as modified. Without this save() -method is not updating data in database
      }
    }
    for (const tlv of topLevelFeatures) {
      try {
        await tlv.save()
      } catch (error) {
        logger.debug?.(`*** FAILED: ${error}`)
        throw error
      }
    }
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  async executeOnClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    for (const change of this.changes) {
      const { featureId, newStart } = change
      const feature = dataStore.getFeature(featureId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${featureId}"`)
      }
      feature.setMin(newStart)
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger, typeName } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((startChange) => ({
      featureId: startChange.featureId,
      oldStart: startChange.newStart,
      newStart: startChange.oldStart,
    }))
    return new LocationStartChange(
      {
        changedIds: inverseChangedIds,
        typeName,
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}

export function isLocationStartChange(
  change: unknown,
): change is LocationStartChange {
  return (change as LocationStartChange).typeName === 'LocationStartChange'
}
