import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from 'apollo-common'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import { Feature } from 'apollo-schemas'

import { AddFeatureChange } from './AddFeatureChange'

interface SerializedDeleteFeatureChangeBase extends SerializedFeatureChange {
  typeName: 'DeleteFeatureChange'
}

export interface DeleteFeatureChangeDetails {
  deletedFeature: AnnotationFeatureSnapshot
  parentFeatureId?: string // Parent feature from where feature was deleted.
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
    const { changes, changedIds, typeName, assembly } = this
    if (changes.length === 1) {
      const [{ deletedFeature, parentFeatureId }] = changes
      return {
        typeName,
        changedIds,
        assembly,
        deletedFeature,
        parentFeatureId,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this

    // Loop the changes
    for (const change of changes) {
      const { deletedFeature, parentFeatureId } = change

      // Search feature
      const featureDoc = await featureModel
        .findOne({ allIds: deletedFeature._id })
        .session(session)
        .exec()
      if (!featureDoc) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${deletedFeature._id}'`
        logger.error(errMsg)
        throw new Error(errMsg)
      }

      // Check if feature is on top level, then simply delete the whole document (i.e. not just sub-feature inside document)
      if (featureDoc._id.equals(deletedFeature._id)) {
        if (parentFeatureId) {
          throw new Error(
            `Feature "${deletedFeature._id}" is top-level, but received a parent feature ID`,
          )
        }
        await featureModel.findByIdAndDelete(featureDoc._id)
        logger.debug?.(
          `Feature "${deletedFeature._id}" deleted from document "${featureDoc._id}". Whole document deleted.`,
        )
        continue
      }

      const deletedIds = this.findAndDeleteChildFeature(
        featureDoc,
        deletedFeature._id,
      )
      featureDoc.allIds = featureDoc.allIds.filter(
        (id) => !deletedIds.includes(id),
      )

      // Save updated document in Mongo
      featureDoc.markModified('children') // Mark as modified. Without this save() -method is not updating data in database
      try {
        await featureDoc.save()
      } catch (error) {
        logger.debug?.(`*** FAILED: ${error}`)
        throw error
      }

      logger.debug?.(
        `Feature "${deletedFeature._id}" deleted from document "${featureDoc._id}"`,
      )
    }
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

  async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }


  async executeOnClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    for (const change of this.changes) {
      const { deletedFeature, parentFeatureId } = change
      if (parentFeatureId) {
        const parentFeature = dataStore.getFeature(parentFeatureId)
        if (!parentFeature) {
          throw new Error(`Could not find parent feature "${parentFeatureId}"`)
        }
        parentFeature.deleteChild(deletedFeature._id)
      } else {
        if (dataStore.getFeature(deletedFeature._id)) {
          dataStore.deleteFeature(deletedFeature._id)
        }
      }
    }
  }

  getInverse() {
    const { changes, changedIds, assembly, logger } = this
    const inverseChangedIds = changedIds.slice().reverse()
    const inverseChanges = changes
      .slice()
      .reverse()
      .map((deleteFeatuerChange) => ({
        addedFeature: deleteFeatuerChange.deletedFeature,
        parentFeatureId: deleteFeatuerChange.parentFeatureId,
      }))
    logger.debug?.(`INVERSE CHANGE '${JSON.stringify(inverseChanges)}'`)
    return new AddFeatureChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'AddFeatureChange',
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}

export function isDeleteFeatureChange(
  change: unknown,
): change is DeleteFeatureChange {
  return (change as DeleteFeatureChange).typeName === 'DeleteFeatureChange'
}
