import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from 'apollo-common'

interface SerializedDiscontinuousLocationStartChangeBase
  extends SerializedFeatureChange {
  typeName: 'DiscontinuousLocationStartChange'
}

interface DiscontinuousLocationStartChangeDetails {
  featureId: string
  oldStart: number
  newStart: number
  index: number
}

interface SerializedDiscontinuousLocationStartChangeSingle
  extends SerializedDiscontinuousLocationStartChangeBase,
    DiscontinuousLocationStartChangeDetails {}

interface SerializedDiscontinuousLocationStartChangeMultiple
  extends SerializedDiscontinuousLocationStartChangeBase {
  changes: DiscontinuousLocationStartChangeDetails[]
}

type SerializedDiscontinuousLocationStartChange =
  | SerializedDiscontinuousLocationStartChangeSingle
  | SerializedDiscontinuousLocationStartChangeMultiple

export class DiscontinuousLocationStartChange extends FeatureChange {
  typeName = 'DiscontinuousLocationStartChange' as const
  changes: DiscontinuousLocationStartChangeDetails[]

  constructor(
    json: SerializedDiscontinuousLocationStartChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedDiscontinuousLocationStartChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ featureId, index, newStart, oldStart }] = changes
      return {
        typeName,
        changedIds,
        assembly,
        featureId,
        oldStart,
        newStart,
        index,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this
    for (const change of changes) {
      const { featureId, index, newStart, oldStart: expectedOldStart } = change
      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      if (topLevelFeature.start > newStart) {
        const errMsg = `ERROR: Feature's new start (${newStart}) can not be lower than parent's start (${topLevelFeature.start}'`
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
          'Must use "LocationStartChange" to change a feature start that does not have discontinuous locations'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      const oldStart = feature.discontinuousLocations[index].start
      if (oldStart !== expectedOldStart) {
        const errMsg = `Location's current start value ${oldStart} doesn't match with expected value ${expectedOldStart}`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      const { end } = feature.discontinuousLocations[index]
      if (newStart >= end) {
        const errMsg = `location start (${newStart}) can't be larger than location end (${end})`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      const previousLocation = feature.discontinuousLocations[index - 1]
      if (previousLocation && newStart <= previousLocation.end) {
        const errMsg = `Location start (${newStart}) can't be larger than  the previous location's end (${previousLocation.end})`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      feature.discontinuousLocations[index].start = newStart
      if (index === 0) {
        feature.start = newStart
      }

      try {
        if (topLevelFeature._id.equals(feature._id)) {
          topLevelFeature.markModified('discontinuousLocations')
        } else {
          topLevelFeature.markModified('children')
        }
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
      const { index, newStart } = this.changes[idx]
      feature.setCDSDiscontinuousLocationStart(newStart, index)
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger, typeName } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((change) => ({
      featureId: change.featureId,
      oldStart: change.newStart,
      newStart: change.oldStart,
      index: change.index,
    }))
    return new DiscontinuousLocationStartChange(
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

export function isDiscontinuousLocationStartChange(
  change: unknown,
): change is DiscontinuousLocationStartChange {
  return (
    (change as DiscontinuousLocationStartChange).typeName ===
    'DiscontinuousLocationStartChange'
  )
}
