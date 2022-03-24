import { GFF3Feature, GFF3FeatureLineWithRefs } from '@gmod/gff'
import { InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { resolveIdentifier } from 'mobx-state-tree'

import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
import {
  Change,
  ClientDataStore,
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
      .findOne({ featureId })
      .exec()

    if (!featureObject) {
      const errMsg = `ERROR when updating MongoDb: The following featureId was not found in database: '${featureId}'`
      console.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    const updatableObjectAsGFFItemArray =
      featureObject.gff3FeatureLineWithRefs as unknown as GFF3FeatureLineWithRefs[]
    console.debug(`Feature found  = ${JSON.stringify(featureObject)}`)
    // Now we need to find correct top level feature or sub-feature inside the feature
    const updatableObject = await this.getObjectByFeatureId(
      updatableObjectAsGFFItemArray,
      featureId,
    )
    if (!updatableObject) {
      const errMsg = `ERROR when updating MongoDb....`
      console.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    console.debug(`Object found: ${JSON.stringify(updatableObject)}`)
    const assignedVal: GFF3FeatureLineWithRefs = Object.assign(updatableObject)
    if (assignedVal.end !== oldEnd) {
      const errMsg = `Old end value in db ${assignedVal.end} does not match with old value ${oldEnd} as given in parameter`
      console.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    // Set new value
    assignedVal.end = newEnd
    await featureObject.markModified('gff3FeatureLineWithRefs') // Mark as modified. Without this save() -method is not updating data in database
    await featureObject.save().catch((error: unknown) => {
      throw new InternalServerErrorException(error)
    })
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
