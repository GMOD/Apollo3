import gff, { GFF3Feature, GFF3FeatureLineWithRefs, GFF3Item } from '@gmod/gff'
import { FeatureDocument } from 'apollo-schemas'
import { resolveIdentifier } from 'mobx-state-tree'

import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
import {
  Change,
  ClientDataStore,
  GFF3FeatureLineWithRefsAndFeatureId,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'

interface EndChange {
  featureId: string
  oldEnd: number
  newEnd: number
}

interface SerializedLocationEndChange extends SerializedChange {
  typeName: 'LocationEndChange'
  changes: EndChange[]
}

export class LocationEndChange extends Change {
  changedIds: string[]
  changes: EndChange[]

  constructor(json: SerializedLocationEndChange) {
    super()
    this.changedIds = json.changedIds
    this.changes = json.changes
  }

  get typeName(): 'LocationEndChange' {
    return 'LocationEndChange'
  }

  toJSON() {
    return {
      changedIds: this.changedIds,
      typeName: this.typeName,
      changes: this.changes,
    }
  }

  // ****** JOS KÄYTTÄÄ NESJS/COMMONia niin tulee luultavasti RUNTIME ERROR **********
  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { changes } = this
    // eslint-disable-next-line prefer-destructuring
    const { featureId, oldEnd: expectedOldEnd, newEnd } = changes[0]

    // Search correct feature
    let featureObject = await backend.featureModel
      .findOne({ allFeatureIds: featureId })
      .exec()

    if (!featureObject) {
      const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
      console.error(errMsg)
      throw new Error(errMsg)
      // throw new NotFoundException(errMsg)  -- This is causing runtime error because Exception comes from @nestjs/common!!!
    }
    console.debug(`*** Feature found: ${JSON.stringify(featureObject)}`)

    // Let's check if featureId is parent feature --> return parent + children
    const parentFeature = await backend.featureModel
      .findOne({ parentFeatureId: featureId })
      .exec()
    if (parentFeature) {
      console.debug(
        `*** Feature was parent level feature: ${JSON.stringify(
          parentFeature,
        )}`,
      )
      featureObject = parentFeature
      if (featureObject.end !== expectedOldEnd) {
        const errMsg = `*** ERROR: Feature's current end value ${featureObject.end} doesn't match with expected value ${expectedOldEnd}`
        console.error(errMsg)
        throw new Error(errMsg)
      }
      // Set new value
      featureObject.end = newEnd
      await featureObject.markModified('end') // Mark as modified. Without this save() -method is not updating data in database
    } else {
      // Feature must be child feature so let's find it.
      const childFeature = await this.getObjectByFeatureId(
        featureObject,
        featureId,
        expectedOldEnd,
        newEnd,
      )
      if (!childFeature) {
        const errMsg = `*** ERROR when searching feature by featureId`
        console.error(errMsg)
        throw new Error(errMsg)
      }
      await featureObject.markModified('child_features') // Mark as modified. Without this save() -method is not updating data in database
      console.debug(
        `*** Feature was child level feature: ${JSON.stringify(featureObject)}`,
      )
    }

    // Update Mongo
    await featureObject.save().catch((error: string) => {
      console.debug(`*** Failed: ${error}`)
      throw new Error(error)
    })
    console.debug(
      `*** Object updated in Mongo. New object: ${JSON.stringify(
        featureObject,
      )}`,
    )
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
      // const { featureId, oldEnd, newEnd } = change
      // const searchApolloIdStr = `"apollo_id":["${featureId}"]`

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
    return new LocationEndChange({
      changedIds: inverseChangedIds,
      typeName: this.typeName,
      changes: inverseChanges,
    })
  }

  /**
   * Get single feature by featureId
   * @param featureObject -
   * @param featureId -
   * @returns
   */
  async getObjectByFeatureId(
    entry: FeatureDocument,
    featureId: string,
    expectedOldEnd: number,
    newEnd: number,
  ) {
    if ('featureId' in entry) {
      const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
        Object.assign(entry)
      // Check if there is also childFeatures in parent feature and it's not empty
      if (
        'child_features' in entry &&
        Object.keys(entry.child_features).length > 0
      ) {
        // Let's get featureId from recursive method
        console.debug(
          `*** FeatureId was not found on top level so lets make recursive call...`,
        )
        const foundRecursiveObject = await this.getNestedFeatureByFeatureId(
          assignedVal,
          featureId,
        )
        if (foundRecursiveObject) {
          if (foundRecursiveObject.end !== expectedOldEnd) {
            const errMsg = `*** ERROR: Feature's current end value ${foundRecursiveObject.end} doesn't match with expected value ${expectedOldEnd}`
            console.error(errMsg)
            throw new Error(errMsg)
          }
          foundRecursiveObject.end = newEnd
          return foundRecursiveObject
        }
      }
    }
    return null
  }

  /**
   *
   * @param parentFeature - parent feature where search will be started
   * @param featureId - featureId to search
   * @returns Found child feature, or return null if feature was not found
   */
  async getNestedFeatureByFeatureId(
    parentFeature: GFF3FeatureLineWithRefs,
    featureId: string,
  ) {
    // If there is child features and size is not 0
    if (
      'child_features' in parentFeature &&
      Object.keys(parentFeature.child_features).length > 0
    ) {
      // Loop each child feature
      for (
        let i = 0;
        i < Object.keys(parentFeature.child_features).length;
        i++
      ) {
        // There can be several features with same ID so we need to loop
        for (let j = 0; parentFeature.child_features[i].length > j; j++) {
          const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
            Object.assign(parentFeature.child_features[i][j])
          // Let's add featureId if it doesn't exist yet
          if ('featureId' in assignedVal) {
            // If featureId matches
            if (assignedVal.featureId === featureId) {
              console.debug(
                `*** Found featureId from recursive object: ${JSON.stringify(
                  assignedVal,
                )}`,
              )
              return assignedVal
            }
          }
          // Check if there is also childFeatures in parent feature and it's not empty
          if (
            'child_features' in assignedVal &&
            Object.keys(assignedVal.child_features).length > 0
          ) {
            // Let's add featureId to each child recursively
            const foundObject = (await this.getNestedFeatureByFeatureId(
              assignedVal,
              featureId,
            )) as GFF3FeatureLineWithRefs
            console.debug(
              `*** Found recursive object: ${JSON.stringify(foundObject)}`,
            )
            if (foundObject != null) {
              return foundObject
            }
          }
        }
      }
    }
    return null
  }

  getUpdatedCacheEntryForFeature(
    gff3Feature: GFF3Feature,
    change: EndChange,
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
      const { featureId, newEnd, oldEnd } = change
      if (apolloId === featureId) {
        if (featureLine.end !== oldEnd) {
          throw new Error(
            `Incoming end ${oldEnd} does not match existing end ${featureLine.end}`,
          )
        }
        featureLine.end = newEnd
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
