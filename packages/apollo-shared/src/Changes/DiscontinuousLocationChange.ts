import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from 'apollo-common'

interface SerializedDiscontinuousLocationChangeBase
  extends SerializedFeatureChange {
  typeName: 'DiscontinuousLocationChange'
}

interface DiscontinuousLocationChangeDetails {
  featureId: string
  start?: {
    newStart: number
    index: number // discontinuous location index
  }
  end?: {
    newEnd: number
    index: number // discontinuous location index
  }
}

interface SerializedDiscontinuousLocationChangeSingle
  extends SerializedDiscontinuousLocationChangeBase,
    DiscontinuousLocationChangeDetails {}

interface SerializedDiscontinuousLocationChangeMultiple
  extends SerializedDiscontinuousLocationChangeBase {
  changes: DiscontinuousLocationChangeDetails[]
}

type SerializedDiscontinuousLocationChange =
  | SerializedDiscontinuousLocationChangeSingle
  | SerializedDiscontinuousLocationChangeMultiple

export class DiscontinuousLocationChange extends FeatureChange {
  typeName = 'DiscontinuousLocationChange' as const
  changes: DiscontinuousLocationChangeDetails[]

  constructor(
    json: SerializedDiscontinuousLocationChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedDiscontinuousLocationChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ end, featureId, start }] = changes
      return { typeName, changedIds, assembly, featureId, start, end }
    }
    return { typeName, changedIds, assembly, changes }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this
    for (const change of changes) {
      const { end, featureId, start } = change
      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
        logger.error(errMsg)
        throw new Error(errMsg)
      }

      const cdsFeature = this.getFeatureFromId(topLevelFeature, featureId)
      if (!cdsFeature?.discontinuousLocations) {
        const errMsg = 'ERROR when searching feature by featureId'
        logger.error(errMsg)
        throw new Error(errMsg)
      }

      let locChanged
      if (start) {
        cdsFeature.discontinuousLocations[start.index].start = start.newStart
        if (start.index === 0) {
          cdsFeature.start = start.newStart
        }
        locChanged = true
      }

      if (end) {
        cdsFeature.discontinuousLocations[end.index].end = end.newEnd
        if (end.index === 0) {
          cdsFeature.end = end.newEnd
        }
        locChanged = true
      }

      if (locChanged) {
        try {
          // Mark as modified. Without this save() -method is not updating data in database
          topLevelFeature.markModified('children')
          await topLevelFeature.save()
        } catch (error) {
          logger.debug?.(`*** FAILED: ${error}`)
          throw error
        }
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
      const { end, start } = this.changes[idx]
      if (start) {
        feature.setCDSDiscontinuousLocationStart(start.newStart, start.index)
      }
      if (end) {
        feature.setCDSDiscontinuousLocationEnd(end.newEnd, end.index)
      }
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger, typeName } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((c) => ({
      featureId: c.featureId,
      start: c.start,
      end: c.end,
    }))
    return new DiscontinuousLocationChange(
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
