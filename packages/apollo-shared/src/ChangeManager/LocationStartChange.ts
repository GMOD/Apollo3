import { resolveIdentifier } from 'mobx-state-tree'
import mongoose from 'mongoose'

import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
import {
  Change,
  ClientDataStore,
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
        if (childFeature.start !== expectedOldStart) {
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

    // Using custom connection
    const db = await mongoose.createConnection(
      'mongodb://localhost:27017/apolloDb',
    )
    const session = await db.startSession()
    session.startTransaction()

    // Let's update objects.
    for (const entry of changes) {
      const { featureId, oldStart: expectedOldStart, newStart } = entry

      // Search correct feature
      let featureObject = await backend.featureModel
        .findOne({ featureIds: featureId })
        .session(session)
        .exec()

      if (!featureObject) {
        const errMsg = `*** ROLLBACK DONE, ERROR: The following featureId was not found in database ='${featureId}'`
        console.error(errMsg)
        await session.abortTransaction()
        session.endSession()
        throw new Error(errMsg)
        // throw new NotFoundException(errMsg)  -- This is causing runtime error because Exception comes from @nestjs/common!!!
      }

      // Let's check if featureId is parent feature --> return parent + children
      const parentFeature = await backend.featureModel
        .findOne({ featureId })
        .session(session)
        .exec()
      if (parentFeature) {
        featureObject = parentFeature
        if (featureObject.start !== expectedOldStart) {
          const errMsg = `*** ROLLBACK DONE, ERROR: Feature's current start value ${featureObject.start} doesn't match with expected value ${expectedOldStart}`
          console.error(errMsg)
          await session.abortTransaction()
          session.endSession()
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
          const errMsg = `*** ROLLBACK DONE, ERROR: when searching feature by featureId`
          console.error(errMsg)
          await session.abortTransaction()
          session.endSession()
          throw new Error(errMsg)
        }
        if (childFeature.start !== expectedOldStart) {
          const errMsg = `*** ROLLBACK DONE, ERROR: Expected old start value ${expectedOldStart} doesn't match value found (${childFeature.start}) in database`
          console.error(errMsg)
          await session.abortTransaction()
          session.endSession()
          throw new Error(errMsg)
        }
        childFeature.start = newStart
        await featureObject.markModified('child_features') // Mark as modified. Without this save() -method is not updating data in database
      }

      console.debug(`*** Let's save changes`)
      // Update Mongo
      await featureObject.save({ session }).catch((error: string) => {
        console.debug(`*** FAILED: ${error}`)
        session.abortTransaction()
        session.endSession()
        throw new Error(error)
      })
      console.debug(
        `*** Object updated in Mongo. New object: ${JSON.stringify(
          featureObject,
        )}`,
      )
    }

    console.debug(`*** Let's commit`)
    await session.commitTransaction()
    console.debug(`*** COMMIT done successfully!`)
    session.endSession()
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
}
