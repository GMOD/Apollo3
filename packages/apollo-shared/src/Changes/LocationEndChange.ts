import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from 'apollo-common'
import { Feature, FeatureDocument } from 'apollo-schemas'

interface SerializedLocationEndChangeBase extends SerializedFeatureChange {
  typeName: 'LocationEndChange'
}

export interface LocationEndChangeDetails {
  featureId: string
  oldEnd: number
  newEnd: number
}

interface SerializedLocationEndChangeSingle
  extends SerializedLocationEndChangeBase,
    LocationEndChangeDetails {}

interface SerializedLocationEndChangeMultiple
  extends SerializedLocationEndChangeBase {
  changes: LocationEndChangeDetails[]
}

type SerializedLocationEndChange =
  | SerializedLocationEndChangeSingle
  | SerializedLocationEndChangeMultiple

export class LocationEndChange extends FeatureChange {
  typeName = 'LocationEndChange' as const
  changes: LocationEndChangeDetails[]

  constructor(json: SerializedLocationEndChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedLocationEndChange {
    const { changes, changedIds, typeName, assembly } = this
    if (changes.length === 1) {
      const [{ featureId, oldEnd, newEnd }] = changes
      return { typeName, changedIds, assembly, featureId, oldEnd, newEnd }
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
      const { featureId, oldEnd } = change

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
      if (foundFeature.end !== oldEnd) {
        const errMsg = `*** ERROR: Feature's current end value ${foundFeature.end} doesn't match with expected value ${oldEnd}`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      featuresForChanges.push({ feature: foundFeature, topLevelFeature })
    }

    // Let's update objects.
    for (const [idx, change] of changes.entries()) {
      const { newEnd } = change
      const { feature, topLevelFeature } = featuresForChanges[idx]
      feature.end = newEnd
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('end') // Mark as modified. Without this save() -method is not updating data in database
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
    this.changedIds.forEach((changedId, idx) => {
      const feature = dataStore.getFeature(changedId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      feature.setEnd(this.changes[idx].newEnd)
    })
  }

  getInverse() {
    const { changes, changedIds, typeName, assembly, logger } = this
    const inverseChangedIds = changedIds.slice().reverse()
    const inverseChanges = changes
      .slice()
      .reverse()
      .map((endChange) => ({
        featureId: endChange.featureId,
        oldEnd: endChange.newEnd,
        newEnd: endChange.oldEnd,
      }))
    return new LocationEndChange(
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

export function isLocationEndChange(
  change: unknown,
): change is LocationEndChange {
  return (change as LocationEndChange).typeName === 'LocationEndChange'
}
