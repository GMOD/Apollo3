import { GFF3FeatureLineWithRefs } from '@gmod/gff'
import { FeatureDocument } from 'apollo-schemas'
import { resolveIdentifier } from 'mobx-state-tree'

import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
import {
  Change,
  ClientDataStore,
  GFF3FeatureLineWithRefsAndFeatureId,
  LocalGFF3DataStore,
  SerializedChange,
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
  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    const { changes } = this
    for (const entry of changes) {
      // eslint-disable-next-line prefer-destructuring
      const { featureId, oldEnd: expectedOldEnd, newEnd } = entry

      // Search correct feature
      let featureObject = await backend.featureModel
        .findOne({ featureIds: featureId })
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
        .findOne({ featureId: featureId })
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
          `*** Feature was child level feature: ${JSON.stringify(
            featureObject,
          )}`,
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
}

