/* eslint-disable @typescript-eslint/require-await */

import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from '@apollo-annotation/common'
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { SplitExonChange } from './SplitExonChange'
import { findAndDeleteChildFeature } from './DeleteFeatureChange'

interface SerializedUndoSplitExonChangeBase extends SerializedFeatureChange {
  typeName: 'UndoSplitExonChange'
}

export interface UndoSplitExonChangeDetails {
  exonToRestore: AnnotationFeatureSnapshot
  parentFeatureId: string
  idsToDelete: string[]
  upstreamCut: number
  downstreamCut: number
  leftExonId: string
  rightExonId: string
}

interface SerializedUndoSplitExonChangeSingle
  extends SerializedUndoSplitExonChangeBase,
    UndoSplitExonChangeDetails {}

interface SerializedUndoSplitExonChangeMultiple
  extends SerializedUndoSplitExonChangeBase {
  changes: UndoSplitExonChangeDetails[]
}

export type SerializedUndoSplitExonChange =
  | SerializedUndoSplitExonChangeSingle
  | SerializedUndoSplitExonChangeMultiple
export class UndoSplitExonChange extends FeatureChange {
  typeName = 'UndoSplitExonChange' as const
  changes: UndoSplitExonChangeDetails[]

  constructor(json: SerializedUndoSplitExonChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedUndoSplitExonChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [
        {
          exonToRestore,
          parentFeatureId,
          idsToDelete,
          upstreamCut,
          downstreamCut,
          leftExonId,
          rightExonId,
        },
      ] = changes

      return {
        typeName,
        changedIds,
        assembly,
        exonToRestore,
        parentFeatureId,
        idsToDelete,
        upstreamCut,
        downstreamCut,
        leftExonId,
        rightExonId,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes } = this
    for (const change of changes) {
      const { exonToRestore, parentFeatureId, idsToDelete } = change
      const topLevelFeature = await featureModel
        .findOne({ allIds: parentFeatureId })
        .session(session)
        .exec()
      if (!topLevelFeature) {
        throw new Error(`Could not find feature with ID "${parentFeatureId}"`)
      }
      const parentFeature = this.getFeatureFromId(
        topLevelFeature,
        parentFeatureId,
      )
      if (!parentFeature) {
        throw new Error(
          `Could not find feature with ID "${parentFeatureId}" in feature "${topLevelFeature._id.toString()}"`,
        )
      }
      if (!parentFeature.children) {
        parentFeature.children = new Map()
      }

      this.addChild(parentFeature, exonToRestore)
      const childIds = this.getChildFeatureIds(exonToRestore)
      topLevelFeature.allIds.push(exonToRestore._id, ...childIds)
      topLevelFeature.allIds = topLevelFeature.allIds.filter(
        (id) => !idsToDelete.includes(id),
      )
      idsToDelete.map((id) =>
        findAndDeleteChildFeature(topLevelFeature, id, this),
      )
      await topLevelFeature.save()
    }
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  async executeOnClient(dataStore: ClientDataStore) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!dataStore) {
      throw new Error('No data store')
    }
    const { changes } = this
    for (const change of changes) {
      const { exonToRestore, parentFeatureId, idsToDelete } = change
      if (!parentFeatureId) {
        throw new Error('Parent ID is missing')
      }
      const parentFeature = dataStore.getFeature(parentFeatureId)
      if (!parentFeature) {
        throw new Error(`Could not find parent feature "${parentFeatureId}"`)
      }
      // create an ID for the parent feature if it does not have one
      if (!parentFeature.attributes.get('_id')) {
        parentFeature.setAttribute('_id', [parentFeature._id])
      }
      parentFeature.addChild(exonToRestore)
      idsToDelete.map((id) => {
        parentFeature.deleteChild(id)
      })
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes]
      .reverse()
      .map((undoSplitExonChange) => ({
        parentFeatureId: undoSplitExonChange.parentFeatureId,
        exonToBeSplit: undoSplitExonChange.exonToRestore,
        upstreamCut: undoSplitExonChange.upstreamCut,
        downstreamCut: undoSplitExonChange.downstreamCut,
        leftExonId: undoSplitExonChange.leftExonId,
        rightExonId: undoSplitExonChange.rightExonId,
      }))

    return new SplitExonChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'SplitExonChange',
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}
