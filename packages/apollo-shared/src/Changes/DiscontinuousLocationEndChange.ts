import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from 'apollo-common'

interface SerializedDiscontinuousLocationEndChangeBase
  extends SerializedFeatureChange {
  typeName: 'DiscontinuousLocationEndChange'
}

interface DiscontinuousLocationEndChangeDetails {
  featureId: string
  oldEnd: number
  newEnd: number
  index: number
}

interface SerializedDiscontinuousLocationEndChangeSingle
  extends SerializedDiscontinuousLocationEndChangeBase,
    DiscontinuousLocationEndChangeDetails {}

interface SerializedDiscontinuousLocationEndChangeMultiple
  extends SerializedDiscontinuousLocationEndChangeBase {
  changes: DiscontinuousLocationEndChangeDetails[]
}

type SerializedDiscontinuousLocationEndChange =
  | SerializedDiscontinuousLocationEndChangeSingle
  | SerializedDiscontinuousLocationEndChangeMultiple

export class DiscontinuousLocationEndChange extends FeatureChange {
  typeName = 'DiscontinuousLocationEndChange' as const
  changes: DiscontinuousLocationEndChangeDetails[]

  constructor(
    json: SerializedDiscontinuousLocationEndChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedDiscontinuousLocationEndChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ featureId, index, newEnd, oldEnd }] = changes
      return {
        typeName,
        changedIds,
        assembly,
        featureId,
        oldEnd,
        newEnd,
        index,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this
    for (const change of changes) {
      const { featureId, index, newEnd, oldEnd: expectedOldEnd } = change
      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
        logger.error(errMsg)
        throw new Error(errMsg)
      }

      const feature = this.getFeatureFromId(topLevelFeature, featureId)
      if (!feature) {
        const errMsg = 'ERROR when searching feature by featureId'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      logger.debug?.(`*** Found feature: ${JSON.stringify(feature)}`)
      if (
        !feature.discontinuousLocations ||
        feature.discontinuousLocations.length === 0
      ) {
        const errMsg =
          'Must use "LocationEndChange" to change a feature end that does not have discontinuous locations'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      const oldEnd = feature.discontinuousLocations[index].end
      if (oldEnd !== expectedOldEnd) {
        const errMsg = `Location's current end value ${oldEnd} doesn't match with expected value ${expectedOldEnd}`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      const { start } = feature.discontinuousLocations[index]
      if (newEnd <= start) {
        const errMsg = `location end (${newEnd}) can't be smaller than location start (${start})`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      const nextLocation = feature.discontinuousLocations[index + 1]
      if (nextLocation && newEnd >= nextLocation.start) {
        const errMsg = `Location end (${newEnd}) can't be larger than  the next location's start (${nextLocation.start})`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      feature.discontinuousLocations[index].end = newEnd
      if (index === feature.discontinuousLocations.length - 1) {
        feature.end = newEnd
      }

      try {
        topLevelFeature.markModified('children')
        await topLevelFeature.save()
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
    for (const [idx, changedId] of this.changedIds.entries()) {
      const feature = dataStore.getFeature(changedId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      const { index, newEnd } = this.changes[idx]
      feature.setCDSDiscontinuousLocationEnd(newEnd, index)
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger, typeName } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((change) => ({
      featureId: change.featureId,
      oldEnd: change.newEnd,
      newEnd: change.oldEnd,
      index: change.index,
    }))
    return new DiscontinuousLocationEndChange(
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

export function isDiscontinuousLocationEndChange(
  change: unknown,
): change is DiscontinuousLocationEndChange {
  return (
    (change as DiscontinuousLocationEndChange).typeName ===
    'DiscontinuousLocationEndChange'
  )
}
