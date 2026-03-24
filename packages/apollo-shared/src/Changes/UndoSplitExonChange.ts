import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

import { SplitExonChange } from './SplitExonChange.js'

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
