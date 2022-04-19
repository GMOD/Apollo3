import gff, { GFF3Feature, GFF3Item } from '@gmod/gff'
import { FeatureDocument } from 'apollo-schemas'
import { resolveIdentifier } from 'mobx-state-tree'

import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
import {
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import {
  FeatureChange,
  GFF3FeatureLineWithFeatureIdAndOptionalRefs,
} from './FeatureChange'

interface StartChange {
  featureId: string
  oldStart: number
  newStart: number
}

interface SerializedLocationStartChange extends SerializedChange {
  typeName: 'LocationStartChange'
  changes: StartChange[]
}

export class LocationStartChange extends FeatureChange {
  changedIds: string[]
  changes: StartChange[]

  constructor(json: SerializedLocationStartChange) {
    super()
    this.changedIds = json.changedIds
    this.changes = json.changes
  }

  get typeName(): 'LocationStartChange' {
    return 'LocationStartChange'
  }

  toJSON() {
    return {
      changedIds: this.changedIds,
      typeName: this.typeName,
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
      const { featureId, oldStart } = change

      // Search correct feature
      const topLevelFeature = await featureModel
        .findOne({ featureIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        console.error(errMsg)
        throw new Error(errMsg)
        // throw new NotFoundException(errMsg)  -- This is causing runtime error because Exception comes from @nestjs/common!!!
      }
      console.debug(`*** Feature found: ${JSON.stringify(topLevelFeature)}`)

      const foundFeature = this.getObjectByFeatureId(topLevelFeature, featureId)
      if (!foundFeature) {
        const errMsg = `ERROR when searching feature by featureId`
        console.error(errMsg)
        throw new Error(errMsg)
      }
      console.debug(`*** Found feature: ${JSON.stringify(foundFeature)}`)
      if (foundFeature.start !== oldStart) {
        const errMsg = `*** ERROR: Feature's current start value ${topLevelFeature.start} doesn't match with expected value ${oldStart}`
        console.error(errMsg)
        throw new Error(errMsg)
      }
      featuresForChanges.push({
        feature: foundFeature,
        topLevelFeature,
      })
    }

    // Let's update objects.
    for (const [idx, change] of changes.entries()) {
      const { newStart } = change
      const { feature, topLevelFeature } = featuresForChanges[idx]
      feature.start = newStart
      if (topLevelFeature.featureId === feature.featureId) {
        topLevelFeature.markModified('start') // Mark as modified. Without this save() -method is not updating data in database
      } else {
        topLevelFeature.markModified('child_features') // Mark as modified. Without this save() -method is not updating data in database
      }

      try {
        await topLevelFeature.save()
      } catch (error) {
        console.debug(`*** FAILED: ${error}`)
        throw error
      } finally {
        // Update Mongo
      }
      console.debug(
        `*** Object updated in Mongo. New object: ${JSON.stringify(
          topLevelFeature,
        )}`,
      )
    }
  }

  /**
   * Applies the required change to cache and overwrites GFF3 file on the server
   * @param backend - parameters from backend
   * @returns
   */
  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    const { changes } = this

    console.debug(`Change request: ${JSON.stringify(changes)}`)
    let gff3ItemString: string | undefined = ''
    const cacheKeys: string[] = await backend.cacheManager.store.keys?.()
    cacheKeys.sort((n1: string, n2: string) => Number(n1) - Number(n2))
    for (const change of changes) {
      // Loop the cache content
      for (const lineNumber of cacheKeys) {
        gff3ItemString = await backend.cacheManager.get(lineNumber)
        if (!gff3ItemString) {
          throw new Error(`No cache value found for key ${lineNumber}`)
        }
        const gff3Item = JSON.parse(gff3ItemString) as GFF3Item
        if (Array.isArray(gff3Item)) {
          const updated = this.getUpdatedCacheEntryForFeature(gff3Item, change)
          if (updated) {
            await backend.cacheManager.set(lineNumber, JSON.stringify(gff3Item))
            break
          }
        }
      }
    }
    // Loop the updated cache and write it into file
    const gff3 = await Promise.all(
      cacheKeys.map(async (keyInd): Promise<GFF3Item> => {
        gff3ItemString = await backend.cacheManager.get(keyInd.toString())
        if (!gff3ItemString) {
          throw new Error(`No entry found for ${keyInd.toString()}`)
        }
        return JSON.parse(gff3ItemString)
      }),
    )
    // console.verbose(`Write into file =${JSON.stringify(cacheValue)}, key=${keyInd}`)
    await backend.gff3Handle.writeFile(gff.formatSync(gff3))
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
      feature.location.setStart(this.changes[idx].newStart)
    })
  }

  getInverse() {
    const inverseChangedIds = this.changedIds.slice().reverse()
    const inverseChanges = this.changes
      .slice()
      .reverse()
      .map((startChange) => ({
        featureId: startChange.featureId,
        oldStart: startChange.newStart,
        newStart: startChange.oldStart,
      }))
    return new LocationStartChange({
      changedIds: inverseChangedIds,
      typeName: this.typeName,
      changes: inverseChanges,
    })
  }

  getUpdatedCacheEntryForFeature(
    gff3Feature: GFF3Feature,
    change: StartChange,
  ): boolean {
    for (const featureLine of gff3Feature) {
      if (
        !(
          'attributes' in featureLine &&
          featureLine.attributes &&
          'apollo_id' in featureLine.attributes &&
          featureLine.attributes.apollo_id
        )
      ) {
        throw new Error(
          `Encountered feature without apollo_id: ${JSON.stringify(
            gff3Feature,
          )}`,
        )
      }
      if (featureLine.attributes.apollo_id.length > 1) {
        throw new Error(
          `Encountered feature with multiple apollo_ids: ${JSON.stringify(
            gff3Feature,
          )}`,
        )
      }
      const [apolloId] = featureLine.attributes.apollo_id
      const { featureId, newStart, oldStart } = change
      if (apolloId === featureId) {
        if (featureLine.start !== oldStart) {
          throw new Error(
            `Incoming start ${oldStart} does not match existing start ${featureLine.start}`,
          )
        }
        featureLine.start = newStart
        return true
      }
      if (featureLine.child_features.length > 0) {
        return featureLine.child_features
          .map((childFeature) =>
            this.getUpdatedCacheEntryForFeature(childFeature, change),
          )
          .some((r) => r)
      }
    }
    return false
  }
}
