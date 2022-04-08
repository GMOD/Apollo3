import { GFF3Feature, GFF3FeatureLineWithRefs } from '@gmod/gff'
import { InternalServerErrorException, NotFoundException } from '@nestjs/common'
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

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    const { changes } = this
    // eslint-disable-next-line prefer-destructuring
    const { featureId, oldEnd, newEnd } = changes[0]
    console.debug(
      `applyToLocalGFF3 -method, End-change request: ${JSON.stringify(
        changes,
      )}`,
    )

    // Search correct feature
    const featureObject = await backend.featureModel
      .findOne({ allFeatureIds: featureId })
      .exec()

    if (!featureObject) {
      const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
      console.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    console.info(`Feature found: ${JSON.stringify(featureObject)}`)

    // Let's check if featureId is parent feature --> return parent + children
    const parentFeature = await backend.featureModel
      .findOne({ parentFeatureId: featureId })
      .exec()
    if (parentFeature) {
      console.info(
        `Feature was parent level feature: ${JSON.stringify(parentFeature)}`,
      )
      // ********* OTA PARENT FEATURE AS UPDATABLE OBJECT *******
    } else {
      // Feature must be child feature
      const foundFeature = await this.getObjectByFeatureId(
        featureObject,
        featureId,
      )
      if (!foundFeature) {
        const errMsg = `ERROR when searching feature by featureId`
        console.error(errMsg)
        throw new NotFoundException(errMsg)
      }
      console.debug(
        `Feature found as child feature: ${JSON.stringify(foundFeature)}`,
      )
    }

    // // // Search correct feature
    // // const featureObject = await backend.featureModel
    // //   .findOne({ featureId })
    // //   .exec()

    // // if (!featureObject) {
    // //   const errMsg = `ERROR when updating MongoDb: The following featureId was not found in database: '${featureId}'`
    // //   console.error(errMsg)
    // //   throw new NotFoundException(errMsg)
    // // }

    // // const updatableObjectAsGFFItemArray =
    // //   featureObject.gff3FeatureLineWithRefs as unknown as GFF3FeatureLineWithRefs[]
    // // console.debug(`Feature found  = ${JSON.stringify(featureObject)}`)
    // // // Now we need to find correct top level feature or sub-feature inside the feature
    // // const updatableObject = await this.getObjectByFeatureId(
    // //   updatableObjectAsGFFItemArray,
    // //   featureId,
    // // )
    // // if (!updatableObject) {
    // //   const errMsg = `ERROR when updating MongoDb....`
    // //   console.error(errMsg)
    // //   throw new NotFoundException(errMsg)
    // // }
    // // console.debug(`Object found: ${JSON.stringify(updatableObject)}`)
    // const assignedVal: GFF3FeatureLineWithRefs = Object.assign(foundFeature)
    // if (assignedVal.end !== oldEnd) {
    //   const errMsg = `Old end value in db ${assignedVal.end} does not match with old value ${oldEnd} as given in parameter`
    //   console.error(errMsg)
    //   throw new NotFoundException(errMsg)
    // }
    // // Set new value
    // assignedVal.end = newEnd
    // await featureObject.markModified('end') // Mark as modified. Without this save() -method is not updating data in database
    // await featureObject.save().catch((error: unknown) => {
    //   throw new InternalServerErrorException(error)
    // })
    console.debug(`Object updated in Mongo`)
    console.debug(`Updated whole object ${JSON.stringify(featureObject)}`)
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
    entry: GFF3FeatureLineWithRefs,
    featureId: string,
  ) {
    console.debug(`Entry=${JSON.stringify(entry)}`)
    if ('featureId' in entry) {
      const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
        Object.assign(entry)

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      console.debug(`Top level featureId=${assignedVal.featureId!}`)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (assignedVal.featureId! === featureId) {
        console.debug(
          `Top level featureId matches in object ${JSON.stringify(
            assignedVal,
          )}`,
        )
        return entry
      }
      // Check if there is also childFeatures in parent feature and it's not empty
      if (
        'child_features' in entry &&
        Object.keys(assignedVal.child_features).length > 0
      ) {
        // Let's get featureId from recursive method
        console.debug(
          `FeatureId was not found on top level so lets make recursive call...`,
        )
        const foundRecursiveObject = await this.getNestedFeatureByFeatureId(
          assignedVal,
          featureId,
        )
        if (foundRecursiveObject) {
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
            console.debug(`Recursive object featureId=${assignedVal.featureId}`)
            // If featureId matches
            if (assignedVal.featureId === featureId) {
              console.debug(
                `Found featureId from recursive object ${JSON.stringify(
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
            // console.debug(`Found recursive object is ${JSON.stringify(foundObject)}`)
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
