import { FeatureDocument } from 'apollo-schemas'
import { resolveIdentifier } from 'mobx-state-tree'

import { AnnotationFeatureLocation } from '../BackendDrivers/AnnotationFeature'
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
  assemblyId: string
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
      const [{ featureId }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        featureId,
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
        .findOne({ featureIds: featureId })
        .session(session)
        .exec()
      if (!featureDoc) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }

      // Check if deleted feature is on top level, then simply delete the whole document
      if (featureDoc.featureId === featureId) {
        await featureModel.deleteOne({ _id: featureDoc._id })
        this.logger.debug?.(
          `Feature "${featureId}" deleted from document "${featureDoc._id}"`,
        )
        return
      }

      const documentAfterDeletion: FeatureDocument =
        await this.deleteFeatureFromDocument(featureDoc, featureDoc, featureId)

        // Save updated document in Mongo
      featureDoc.markModified('child_features') // Mark as modified. Without this save() -method is not updating data in database
      try {
        await documentAfterDeletion.save()
      } catch (error) {
        this.logger.debug?.(`*** FAILED: ${error}`)
        throw error
      }

      this.logger.debug?.(
        `Feature "${featureId}" deleted from document "${featureDoc._id}"`,
      )
    }
  }

  /**
   * Delete feature and feature's subfeatures if any. Also remove deleted featureIds from top level 'FeatureIds' -property
   * @param topLevelDocument - Top level document
   * @param currentTopLevelFeature - Currently processed feature
   * @param featureIdToDelete - FeatureId that will be deleted
   * @returns
   */
  async deleteFeatureFromDocument(
    topLevelDocument: FeatureDocument,
    currentTopLevelFeature: any,
    featureIdToDelete: string,
  ) {
    let ind = 0
    // If feature has child features
    if (currentTopLevelFeature.child_features) {
      for (const childFeature of currentTopLevelFeature.child_features || []) {
        for (const childFeatureLine of childFeature) {
          if (childFeatureLine.featureId === featureIdToDelete) {
            this.logger.debug?.(
              `Found featureid "${childFeatureLine.featureId}", let's delete it`,
            )
            // Get children's featureIds
            const childrenFeatureIds: string[] = this.getChildrenFeatureIds(
              childFeatureLine,
              [featureIdToDelete],
            )
            // Delete feature
            currentTopLevelFeature.child_features.splice(ind, 1)
            // Delete featureId and its children's featureIds from top level featureIds -array
            for (const childId of childrenFeatureIds) {
              const index = topLevelDocument.featureIds.indexOf(childId, 0)
              if (index > -1) {
                topLevelDocument.featureIds.splice(index, 1)
              }
            }
            continue
          }
          if (childFeatureLine.child_features) {
            this.deleteFeatureFromDocument(
              topLevelDocument,
              childFeatureLine.child_features,
              featureIdToDelete,
            )
          }
        }
        ind++
      }
    } else {
      // Feature is a leaf i.e. feature has no children
      for (const [
        entryIndex,
        topLevelEntry,
      ] of currentTopLevelFeature.entries()) {
        for (const [, currentFeature] of topLevelEntry.entries()) {
          if (currentFeature.featureId === featureIdToDelete) {
            this.logger.debug?.(
              `Found featureid "${currentFeature.featureId}", let's delete it`,
            )
            // Get children's featureIds
            const childrenFeatureIds: string[] = this.getChildrenFeatureIds(
              currentFeature,
              [],
            )
            // Delete feature
            currentTopLevelFeature.splice(entryIndex, 1)
            // Delete featureId and its children's featureIds from top level featureIds -array
            for (const childId of childrenFeatureIds) {
              const index = topLevelDocument.featureIds.indexOf(childId, 0)
              if (index > -1) {
                topLevelDocument.featureIds.splice(index, 1)
              }
            }
            continue
          }
          if (currentFeature.child_features) {
            this.deleteFeatureFromDocument(
              topLevelDocument,
              currentFeature.child_features,
              featureIdToDelete,
            )
          }
        }
      }
    }
    return currentTopLevelFeature
  }

  /**
   * Get children feature ids
   * @param parentFeature - parent feature
   * @param featureIds
   * @returns
   */
  getChildrenFeatureIds(parentFeature: any, featureIds: string[]): string[] {
    if (!parentFeature.child_features) {
      this.logger.debug?.(
        `*** Id to be deleted from top level array: ${parentFeature.featureId}`,
      )
      featureIds.push(parentFeature.featureId)
      return featureIds
    }
    // If there are child features
    if (parentFeature.child_features) {
      for (const childFeature of parentFeature.child_features || []) {
        for (const childFeatureLine of childFeature) {
          this.getChildrenFeatureIds(childFeatureLine, featureIds)
        }
      }
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
        AnnotationFeatureLocation,
        dataStore.features,
        changedId,
      )
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
    })
  }

  getInverse() {
    const inverseChangedIds = this.changedIds.slice().reverse()
    const inverseChanges = this.changes
      .slice()
      .reverse()
      .map((endChange) => ({
        featureId: endChange.featureId,
        assemblyId: endChange.assemblyId,
      }))
    return new DeleteFeatureChange(
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

export function isDeleteFeatureChange(
  change: unknown,
): change is DeleteFeatureChange {
  return (change as DeleteFeatureChange).typeName === 'DeleteFeatureChange'
}
