/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from '@apollo-annotation/apollo-common'
import { Feature, FeatureDocument } from '@apollo-annotation/apollo-schemas'

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

type SerializedLocationStartChange =
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
    const featuresForChanges: {
      feature: Feature
      topLevelFeature: FeatureDocument
    }[] = []
    // Let's first check that all features are found and those old values match with expected ones. We do this just to be sure that all changes can be done.
    for (const change of changes) {
      const { featureId, oldStart } = change

      // Search correct feature
      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        logger.error(errMsg)
        throw new Error(errMsg)
        // throw new NotFoundException(errMsg)  -- This is causing runtime error because Exception comes from @nestjs/common!!!
      }
      logger.debug?.(`*** Feature found: ${JSON.stringify(topLevelFeature)}`)

      const foundFeature = this.getFeatureFromId(topLevelFeature, featureId)
      if (!foundFeature) {
        const errMsg = 'ERROR when searching feature by featureId'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      logger.debug?.(`*** Found feature: ${JSON.stringify(foundFeature)}`)
      if (
        foundFeature.discontinuousLocations &&
        foundFeature.discontinuousLocations.length > 0
      ) {
        const errMsg =
          'Must use "DiscontinuousLocationStartChange" to change a feature start that has discontinuous locations'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      if (foundFeature.start !== oldStart) {
        const errMsg = `*** ERROR: Feature's current start value ${foundFeature.start} doesn't match with expected value ${oldStart}`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      featuresForChanges.push({ feature: foundFeature, topLevelFeature })
    }

    // Let's update objects.
    for (const [idx, change] of changes.entries()) {
      const { newStart } = change
      const { feature, topLevelFeature } = featuresForChanges[idx]
      feature.start = newStart
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('start') // Mark as modified. Without this save() -method is not updating data in database
      } else {
        topLevelFeature.markModified('children') // Mark as modified. Without this save() -method is not updating data in database
      }

      try {
        await topLevelFeature.save()
      } catch (error) {
        logger.debug?.(`*** FAILED: ${error}`)
        throw error
      }
      logger.debug?.(
        `*** Object updated in Mongo. New object: ${JSON.stringify(
          topLevelFeature,
        )}`,
      )
    }
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  async executeOnClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    for (const [idx, changedId] of this.changedIds.entries()) {
      const feature = dataStore.getFeature(changedId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      feature.setStart(this.changes[idx].newStart)
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
