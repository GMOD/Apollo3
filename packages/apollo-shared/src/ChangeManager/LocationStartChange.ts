import { GFF3Feature, GFF3FeatureLineWithRefs } from '@gmod/gff'
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
import { FeatureChange } from './FeatureChange'

interface StartChange {
  featureId: string
  oldStart: number
  newStart: number
}

interface SerializedLocationStartChange extends SerializedChange {
  typeName: 'LocationStartChange'
  changes: StartChange[]
}

export class LocationStartChange extends Change {
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
  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    const { changes } = this
 
    // Let's first check that all features are found and those old values match with expected ones. We do this just to be sure that all changes can be done.
    for (const entry of changes) {
      // eslint-disable-next-line prefer-destructuring
      const { featureId, oldStart: expectedOldStart } = entry

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
        .findOne({ featureId })
        .exec()
      if (parentFeature) {
        console.debug(
          `*** Feature was parent level feature: ${JSON.stringify(
            parentFeature,
          )}`,
        )
        featureObject = parentFeature
        if (featureObject.start !== expectedOldStart) {
          const errMsg = `*** ERROR: Feature's current start value ${featureObject.start} doesn't match with expected value ${expectedOldStart}`
          console.error(errMsg)
          throw new Error(errMsg)
        }
      } else {
        // Feature must be child feature so let's find it.
        const childFeature = await FeatureChange.getObjectByFeatureId(
          featureObject,
          featureId,
        )
        if (!childFeature) {
          const errMsg = `*** ERROR when searching feature by featureId`
          console.error(errMsg)
          throw new Error(errMsg)
        }
        if (childFeature.start != expectedOldStart) {
          const errMsg = `*** ERROR Expected old start value ${expectedOldStart} doesn't match value found (${childFeature.start}) in database`
          console.error(errMsg)
          throw new Error(errMsg)
        }
        console.debug(
          `*** Feature was child level feature: ${JSON.stringify(
            featureObject,
          )}`,
        )
      }
    }

    // Let's update objects. Should we still make same checks as above or just skip the changes????
    for (const entry of changes) {
      // eslint-disable-next-line prefer-destructuring
      const { featureId, oldStart: expectedOldStart, newStart } = entry

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
        .findOne({ featureId })
        .exec()
      if (parentFeature) {
        console.debug(
          `*** Feature was parent level feature: ${JSON.stringify(
            parentFeature,
          )}`,
        )
        featureObject = parentFeature
        if (featureObject.start !== expectedOldStart) {
          const errMsg = `*** ERROR: Feature's current start value ${featureObject.start} doesn't match with expected value ${expectedOldStart}`
          console.error(errMsg)
          throw new Error(errMsg)
        }
        // Set new value
        featureObject.start = newStart
        await featureObject.markModified('start') // Mark as modified. Without this save() -method is not updating data in database
      } else {
        // Feature must be child feature so let's find it.
        const childFeature = await FeatureChange.getObjectByFeatureId(
          featureObject,
          featureId,
        )
        if (!childFeature) {
          const errMsg = `*** ERROR when searching feature by featureId`
          console.error(errMsg)
          throw new Error(errMsg)
        }
        if (childFeature.start != expectedOldStart) {
          const errMsg = `*** ERROR Expected old start value ${expectedOldStart} doesn't match value found (${childFeature.start}) in database`
          console.error(errMsg)
          throw new Error(errMsg)
        }
        childFeature.start = newStart
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

  // /**
  //  * Get single feature by featureId
  //  * @param featureObject -
  //  * @param featureId -
  //  * @returns
  //  */
  // async getObjectByFeatureId(
  //   entry: FeatureDocument,
  //   featureId: string,
  //   expectedOldStart: number,
  //   newStart: number,
  // ) {
  //   if ('featureId' in entry) {
  //     const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
  //       Object.assign(entry)
  //     // Check if there is also childFeatures in parent feature and it's not empty
  //     if (
  //       'child_features' in entry &&
  //       Object.keys(entry.child_features).length > 0
  //     ) {
  //       // Let's get featureId from recursive method
  //       console.debug(
  //         `*** FeatureId was not found on top level so lets make recursive call...`,
  //       )
  //       const foundRecursiveObject = await this.getNestedFeatureByFeatureId(
  //         assignedVal,
  //         featureId,
  //       )
  //       if (foundRecursiveObject) {
  //         if (foundRecursiveObject.start !== expectedOldStart) {
  //           const errMsg = `*** ERROR: Feature's current start value ${foundRecursiveObject.start} doesn't match with expected value ${expectedOldStart}`
  //           console.error(errMsg)
  //           throw new Error(errMsg)
  //         }
  //         foundRecursiveObject.start = newStart
  //         return foundRecursiveObject
  //       }
  //     }
  //   }
  //   return null
  // }

  // /**
  //  *
  //  * @param parentFeature - parent feature where search will be started
  //  * @param featureId - featureId to search
  //  * @returns Found child feature, or return null if feature was not found
  //  */
  // async getNestedFeatureByFeatureId(
  //   parentFeature: GFF3FeatureLineWithRefs,
  //   featureId: string,
  // ) {
  //   // If there is child features and size is not 0
  //   if (
  //     'child_features' in parentFeature &&
  //     Object.keys(parentFeature.child_features).length > 0
  //   ) {
  //     // Loop each child feature
  //     for (
  //       let i = 0;
  //       i < Object.keys(parentFeature.child_features).length;
  //       i++
  //     ) {
  //       // There can be several features with same ID so we need to loop
  //       for (let j = 0; parentFeature.child_features[i].length > j; j++) {
  //         const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
  //           Object.assign(parentFeature.child_features[i][j])
  //         // Let's add featureId if it doesn't exist yet
  //         if ('featureId' in assignedVal) {
  //           // If featureId matches
  //           if (assignedVal.featureId === featureId) {
  //             console.debug(
  //               `*** Found featureId from recursive object: ${JSON.stringify(
  //                 assignedVal,
  //               )}`,
  //             )
  //             return assignedVal
  //           }
  //         }
  //         // Check if there is also childFeatures in parent feature and it's not empty
  //         if (
  //           'child_features' in assignedVal &&
  //           Object.keys(assignedVal.child_features).length > 0
  //         ) {
  //           // Let's add featureId to each child recursively
  //           const foundObject = (await this.getNestedFeatureByFeatureId(
  //             assignedVal,
  //             featureId,
  //           )) as GFF3FeatureLineWithRefs
  //           console.debug(
  //             `*** Found recursive object: ${JSON.stringify(foundObject)}`,
  //           )
  //           if (foundObject != null) {
  //             return foundObject
  //           }
  //         }
  //       }
  //     }
  //   }
  //   return null
  // }
}

// import gff, { GFF3Feature, GFF3Item } from '@gmod/gff'
// import { resolveIdentifier } from 'mobx-state-tree'

// import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
// import {
//   ClientDataStore,
//   LocalGFF3DataStore,
//   SerializedChange,
//   ServerDataStore,
// } from './Change'
// import { FeatureChange } from './FeatureChange'

// interface StartChange {
//   featureId: string
//   oldStart: number
//   newStart: number
// }

// interface SerializedLocationStartChange extends SerializedChange {
//   typeName: 'LocationStartChange'
//   changes: StartChange[]
// }

// export class LocationStartChange extends FeatureChange {
//   changedIds: string[]
//   changes: StartChange[]

//   constructor(json: SerializedLocationStartChange) {
//     super()
//     this.changedIds = json.changedIds
//     this.changes = json.changes
//   }

//   get typeName(): 'LocationStartChange' {
//     return 'LocationStartChange'
//   }

//   toJSON() {
//     return {
//       changedIds: this.changedIds,
//       typeName: this.typeName,
//       changes: this.changes,
//     }
//   }

//   /**
//    * Applies the required change to database
//    * @param backend - parameters from backend
//    * @returns
//    */
//   async applyToServer(backend: ServerDataStore) {
//     const { changes } = this
//     for (const entry of changes) {
//       const { featureId, oldStart: expectedOldStart, newStart } = entry

//       // Search correct feature
//       const topLevelFeature = await backend.featureModel
//         .findOne({ featureIds: featureId })
//         .exec()

//       if (!topLevelFeature) {
//         const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
//         console.error(errMsg)
//         throw new Error(errMsg)
//         // throw new NotFoundException(errMsg)  -- This is causing runtime error because Exception comes from @nestjs/common!!!
//       }
//       console.debug(`*** Feature found: ${JSON.stringify(topLevelFeature)}`)

//       const foundFeature = this.getObjectByFeatureId(topLevelFeature, featureId)
//       if (!foundFeature) {
//         const errMsg = `ERROR when searching feature by featureId`
//         console.error(errMsg)
//         throw new Error(errMsg)
//       }
//       console.debug(`*** Found feature: ${JSON.stringify(foundFeature)}`)
//       if (foundFeature.start !== expectedOldStart) {
//         const errMsg = `*** ERROR: Feature's current start value ${topLevelFeature.start} doesn't match with expected value ${expectedOldStart}`
//         console.error(errMsg)
//         throw new Error(errMsg)
//       }
//       foundFeature.start = newStart
//       if (topLevelFeature.featureId === foundFeature.featureId) {
//         topLevelFeature.markModified('start') // Mark as modified. Without this save() -method is not updating data in database
//       } else {
//         topLevelFeature.markModified('child_features') // Mark as modified. Without this save() -method is not updating data in database
//       }

//       // Update Mongo
//       await topLevelFeature.save().catch((error: string) => {
//         console.debug(`*** Failed: ${error}`)
//         throw new Error(error)
//       })
//       console.debug(
//         `*** Object updated in Mongo. New object: ${JSON.stringify(
//           topLevelFeature,
//         )}`,
//       )
//     }
//   }

//   /**
//    * Applies the required change to cache and overwrites GFF3 file on the server
//    * @param backend - parameters from backend
//    * @returns
//    */
//   async applyToLocalGFF3(backend: LocalGFF3DataStore) {
//     const { changes } = this

//     console.debug(`Change request: ${JSON.stringify(changes)}`)
//     let gff3ItemString: string | undefined = ''
//     const cacheKeys: string[] = await backend.cacheManager.store.keys?.()
//     cacheKeys.sort((n1: string, n2: string) => Number(n1) - Number(n2))
//     for (const change of changes) {
//       // Loop the cache content
//       for (const lineNumber of cacheKeys) {
//         gff3ItemString = await backend.cacheManager.get(lineNumber)
//         if (!gff3ItemString) {
//           throw new Error(`No cache value found for key ${lineNumber}`)
//         }
//         const gff3Item = JSON.parse(gff3ItemString) as GFF3Item
//         if (Array.isArray(gff3Item)) {
//           const updated = this.getUpdatedCacheEntryForFeature(gff3Item, change)
//           if (updated) {
//             await backend.cacheManager.set(lineNumber, JSON.stringify(gff3Item))
//             break
//           }
//         }
//       }
//     }
//     // Loop the updated cache and write it into file
//     const gff3 = await Promise.all(
//       cacheKeys.map(async (keyInd): Promise<GFF3Item> => {
//         gff3ItemString = await backend.cacheManager.get(keyInd.toString())
//         if (!gff3ItemString) {
//           throw new Error(`No entry found for ${keyInd.toString()}`)
//         }
//         return JSON.parse(gff3ItemString)
//       }),
//     )
//     // console.verbose(`Write into file =${JSON.stringify(cacheValue)}, key=${keyInd}`)
//     await backend.gff3Handle.writeFile(gff.formatSync(gff3))
//   }

//   async applyToClient(dataStore: ClientDataStore) {
//     if (!dataStore) {
//       throw new Error('No data store')
//     }
//     this.changedIds.forEach((changedId, idx) => {
//       const feature = resolveIdentifier(
//         AnnotationFeature,
//         dataStore.features,
//         changedId,
//       )
//       if (!feature) {
//         throw new Error(`Could not find feature with identifier "${changedId}"`)
//       }
//       feature.location.setStart(this.changes[idx].newStart)
//     })
//   }

//   getInverse() {
//     const inverseChangedIds = this.changedIds.slice().reverse()
//     const inverseChanges = this.changes
//       .slice()
//       .reverse()
//       .map((startChange) => ({
//         featureId: startChange.featureId,
//         oldStart: startChange.newStart,
//         newStart: startChange.oldStart,
//       }))
//     return new LocationStartChange({
//       changedIds: inverseChangedIds,
//       typeName: this.typeName,
//       changes: inverseChanges,
//     })
//   }

//   getUpdatedCacheEntryForFeature(
//     gff3Feature: GFF3Feature,
//     change: StartChange,
//   ): boolean {
//     for (const featureLine of gff3Feature) {
//       if (
//         !(
//           'attributes' in featureLine &&
//           featureLine.attributes &&
//           'apollo_id' in featureLine.attributes &&
//           featureLine.attributes.apollo_id
//         )
//       ) {
//         throw new Error(
//           `Encountered feature without apollo_id: ${JSON.stringify(
//             gff3Feature,
//           )}`,
//         )
//       }
//       if (featureLine.attributes.apollo_id.length > 1) {
//         throw new Error(
//           `Encountered feature with multiple apollo_ids: ${JSON.stringify(
//             gff3Feature,
//           )}`,
//         )
//       }
//       const [apolloId] = featureLine.attributes.apollo_id
//       const { featureId, newStart, oldStart } = change
//       if (apolloId === featureId) {
//         if (featureLine.start !== oldStart) {
//           throw new Error(
//             `Incoming start ${oldStart} does not match existing start ${featureLine.start}`,
//           )
//         }
//         featureLine.start = newStart
//         return true
//       }
//       if (featureLine.child_features.length > 0) {
//         return featureLine.child_features
//           .map((childFeature) =>
//             this.getUpdatedCacheEntryForFeature(childFeature, change),
//           )
//           .some((r) => r)
//       }
//     }
//     return false
//   }
// }
