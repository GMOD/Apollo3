import { AnnotationFeature } from 'apollo-mst'
import { Feature } from 'apollo-schemas'
import { resolveIdentifier } from 'mobx-state-tree'

import { AnnotationFeatureLocation } from '../BackendDrivers/AnnotationFeature'
import { AddFeatureChange } from './AddFeatureChange'
import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import { FeatureChange } from './FeatureChange'

interface SerializedDeleteFeatureChangeBase extends SerializedChange {
  typeName: 'DeleteFeatureChange'
}

export interface DeleteFeatureChangeDetails {
  featureId: string
  parentFeatureId: string // Parent feature from where feature was deleted.
  featureString: string // Deleted feature as string
}

interface SerializedDeleteFeatureChangeSingle
  extends SerializedDeleteFeatureChangeBase,
    DeleteFeatureChangeDetails {}

interface SerializedDeleteFeatureChangeMultiple
  extends SerializedDeleteFeatureChangeBase {
  changes: DeleteFeatureChangeDetails[]
}

type SerializedDeleteFeatureChange =
  | SerializedDeleteFeatureChangeSingle
  | SerializedDeleteFeatureChangeMultiple

export class DeleteFeatureChange extends FeatureChange {
  typeName = 'DeleteFeatureChange' as const
  changes: DeleteFeatureChangeDetails[]

  constructor(json: SerializedDeleteFeatureChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedDeleteFeatureChange {
    if (this.changes.length === 1) {
      const [{ featureId, parentFeatureId, featureString }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        featureId,
        parentFeatureId,
        featureString,
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

    // Loop the changes
    for (const change of changes) {
      const { featureId } = change

      // Search feature
      const featureDoc = await featureModel
        .findOne({ allIds: featureId })
        .session(session)
        .exec()
      if (!featureDoc) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }

      // Check if feature is on top level, then simply delete the whole document (i.e. not just sub-feature inside document)
      if (featureDoc.featureId === featureId) {
        // Update change
        change.parentFeatureId = featureId
        change.featureString = JSON.stringify(featureDoc)
        await featureModel.deleteOne({ _id: featureDoc._id })
        this.logger.debug?.(
          `Feature "${featureId}" deleted from document "${featureDoc._id}". Whole document deleted.`,
        )
        continue
      }

      const deletedIds = this.findAndDeleteChildFeature(featureDoc, featureId)
      featureDoc.allIds = featureDoc.allIds.filter(
        (id) => !deletedIds.includes(id),
      )

      // Save updated document in Mongo
      featureDoc.markModified('children') // Mark as modified. Without this save() -method is not updating data in database
      try {
        await featureDoc.save()
      } catch (error) {
        this.logger.debug?.(`*** FAILED: ${error}`)
        throw error
      }

      this.logger.debug?.(
        `Feature "${featureId}" deleted from document "${featureDoc._id}"`,
      )
    }
    const addJSON = this.getInverse()
    this.logger.debug?.(
      `DELETE FEATURE, GET INVERSE : ${JSON.stringify(addJSON)}`,
    )
  }

  /**
   * Delete feature's subfeatures that match an ID and return the IDs of any
   * sub-subfeatures that were deleted
   * @param feature -
   * @param featureIdToDelete -
   * @returns - list of deleted feature IDs
   */
  findAndDeleteChildFeature(
    feature: Feature,
    featureIdToDelete: string,
  ): string[] {
    if (!feature.children) {
      throw new Error(`Feature ${feature._id} has no children`)
    }
    const { children } = feature
    const child = children.get(featureIdToDelete)
    if (child) {
      const deletedIds = this.getChildFeatureIds(child)
      children.delete(featureIdToDelete)
      return deletedIds
    }
    for (const [, childFeature] of children) {
      try {
        return this.findAndDeleteChildFeature(childFeature, featureIdToDelete)
      } catch (error) {
        // pass
      }
    }

    throw new Error(
      `Feature "${featureIdToDelete}" not found in ${feature._id}`,
    )
  }

  /**
   * Get children's feature ids
   * @param parentFeature - parent feature
   * @param featureIds - list of children's featureIds
   * @returns
   */
  getChildFeatureIds(feature: Feature): string[] {
    if (!feature.children) {
      return []
    }
    const featureIds = []
    for (const [, childFeature] of feature.children || []) {
      featureIds.push(...this.getChildFeatureIds(childFeature))
    }
    return featureIds
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
    })
  }

  getInverse() {
    const tmpArray: string[] = []
    const inverseChangedIds = this.changedIds.slice().reverse()
    const inverseChanges = this.changes
      .slice()
      .reverse()
      .map((addFeatChange) => ({
        stringOfGFF3: addFeatChange.featureString,
        stringType: 1,
        newFeatureIds: tmpArray,
        parentFeatureId: addFeatChange.parentFeatureId,
      }))
    this.logger.debug?.(`INVERSE CHANGE '${JSON.stringify(inverseChanges)}'`)
    return new AddFeatureChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'AddFeatureChange',
        changes: inverseChanges,
        assemblyId: this.assemblyId,
      },
      { logger: this.logger },
    )
  }
}

export function isDeleteFeatureChange(
  change: unknown,
): change is DeleteFeatureChange {
  return (change as DeleteFeatureChange).typeName === 'DeleteFeatureChange'
}
