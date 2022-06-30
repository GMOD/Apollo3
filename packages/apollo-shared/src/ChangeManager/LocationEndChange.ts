import { Change, FeatureDocument } from 'apollo-schemas'
import { resolveIdentifier } from 'mobx-state-tree'

import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import {
  FeatureChange,
  GFF3FeatureLineWithFeatureIdAndOptionalRefs,
} from './FeatureChange'

interface SerializedLocationEndChangeBase extends SerializedChange {
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
    if (this.changes.length === 1) {
      const [{ featureId, oldEnd, newEnd }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        featureId,
        oldEnd,
        newEnd,
      }
    }
    return {
      typeName: this.typeName,
      changedIds: this.changedIds,
      assemblyId: this.assemblyId,
      changes: this.changes,
    }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes } = this
    const featuresForChanges: {
      feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs
      topLevelFeature: FeatureDocument
    }[] = []
    // Let's first check that all features are found and those old values match with expected ones. We do this just to be sure that all changes can be done.
    for (const change of changes) {
      const { featureId, oldEnd } = change

      // Search correct feature
      const topLevelFeature = await featureModel
        .findOne({ featureIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
        // throw new NotFoundException(errMsg)  -- This is causing runtime error because Exception comes from @nestjs/common!!!
      }
      this.logger.debug?.(
        `*** Feature found: ${JSON.stringify(topLevelFeature)}`,
      )

      const foundFeature = this.getObjectByFeatureId(topLevelFeature, featureId)
      if (!foundFeature) {
        const errMsg = `ERROR when searching feature by featureId`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug?.(`*** Found feature: ${JSON.stringify(foundFeature)}`)
      if (foundFeature.end !== oldEnd) {
        const errMsg = `*** ERROR: Feature's current end value ${foundFeature.end} doesn't match with expected value ${oldEnd}`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      featuresForChanges.push({
        feature: foundFeature,
        topLevelFeature,
      })
    }

    // Let's update objects.
    for (const [idx, change] of changes.entries()) {
      const { newEnd } = change
      const { feature, topLevelFeature } = featuresForChanges[idx]
      feature.end = newEnd
      if (topLevelFeature.featureId === feature.featureId) {
        topLevelFeature.markModified('end') // Mark as modified. Without this save() -method is not updating data in database
      } else {
        topLevelFeature.markModified('child_features') // Mark as modified. Without this save() -method is not updating data in database
      }

      try {
        await topLevelFeature.save()
      } catch (error) {
        this.logger.debug?.(`*** FAILED: ${error}`)
        throw error
      }
      this.logger.debug?.(
        `*** Object updated in Mongo. New object: ${JSON.stringify(
          topLevelFeature,
        )}`,
      )
    }
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  async applyToClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    this.changedIds.forEach((changedId, idx) => {
      const feature = resolveIdentifier(
        AnnotationFeature,
        dataStore.features,
        changedId,
      )
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      feature.location.setEnd(this.changes[idx].newEnd)
    })
  }

  getInverse() {
    const inverseChangedIds = this.changedIds.slice().reverse()
    const inverseChanges = this.changes
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
        typeName: this.typeName,
        changes: inverseChanges,
        assemblyId: this.assemblyId,
      },
      { logger: this.logger },
    )
  }
}

export function isLocationEndChange(
  change: unknown,
): change is LocationEndChange {
  return (
    // change instanceof Change &&
    (change as LocationEndChange).typeName === 'LocationEndChange'
  )
}
