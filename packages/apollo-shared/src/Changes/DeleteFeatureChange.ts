/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import type { Feature } from '@apollo-annotation/schemas'

import { AddFeatureChange } from './AddFeatureChange.js'

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

export type SerializedDeleteFeatureChange =
  | SerializedDeleteFeatureChangeSingle
  | SerializedDeleteFeatureChangeMultiple

export class DeleteFeatureChange extends FeatureChange {
  typeName = 'DeleteFeatureChange' as const
  changes: DeleteFeatureChangeDetails[]

  constructor(json: SerializedDeleteFeatureChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification() {
    return 'Feature deleted successfully'
  }

  toJSON(): SerializedDeleteFeatureChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ deletedFeature, parentFeatureId }] = changes
      return { typeName, changedIds, assembly, deletedFeature, parentFeatureId }
    }
    return { typeName, changedIds, assembly, changes }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes]
      .reverse()
      .map((deleteFeatureChange) => ({
        addedFeature: deleteFeatureChange.deletedFeature,
        parentFeatureId: deleteFeatureChange.parentFeatureId,
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

/**
 * Delete feature's subfeatures that match an ID and return the IDs of any
 * sub-subfeatures that were deleted
 * @param feature -
 * @param featureIdToDelete -
 * @returns - list of deleted feature IDs
 */
export function findAndDeleteChildFeature(
  feature: Feature,
  featureIdToDelete: string,
  change: FeatureChange,
): string[] {
  if (!feature.children) {
    throw new Error(`Feature ${feature._id} has no children`)
  }
  const { _id, children } = feature
  const child = children.get(featureIdToDelete)
  if (child) {
    const deletedIds = change.getChildFeatureIds(child)
    children.delete(featureIdToDelete)
    return deletedIds
  }
  for (const [, childFeature] of children) {
    try {
      return findAndDeleteChildFeature(childFeature, featureIdToDelete, change)
    } catch {
      // pass
    }
  }

  throw new Error(`Feature "${featureIdToDelete}" not found in ${_id}`)
}

export function isDeleteFeatureChange(
  change: unknown,
): change is DeleteFeatureChange {
  return (change as DeleteFeatureChange).typeName === 'DeleteFeatureChange'
}
