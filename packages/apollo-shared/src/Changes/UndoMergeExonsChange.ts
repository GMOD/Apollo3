import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

import { MergeExonsChange } from './MergeExonsChange.js'

interface SerializedUndoMergeExonsChangeBase extends SerializedFeatureChange {
  typeName: 'UndoMergeExonsChange'
}

export interface UndoMergeExonsChangeDetails {
  exonsToRestore: AnnotationFeatureSnapshot[]
  parentFeatureId: string
}

interface SerializedUndoMergeExonsChangeSingle
  extends SerializedUndoMergeExonsChangeBase,
    UndoMergeExonsChangeDetails {}

interface SerializedUndoMergeExonsChangeMultiple
  extends SerializedUndoMergeExonsChangeBase {
  changes: UndoMergeExonsChangeDetails[]
}

export type SerializedUndoMergeExonsChange =
  | SerializedUndoMergeExonsChangeSingle
  | SerializedUndoMergeExonsChangeMultiple
export class UndoMergeExonsChange extends FeatureChange {
  typeName = 'UndoMergeExonsChange' as const
  changes: UndoMergeExonsChangeDetails[]

  constructor(json: SerializedUndoMergeExonsChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedUndoMergeExonsChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ exonsToRestore, parentFeatureId }] = changes

      return {
        typeName,
        changedIds,
        assembly,
        exonsToRestore,
        parentFeatureId,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes]
      .reverse()
      .map((undoMergeExonsChange) => ({
        firstExon: undoMergeExonsChange.exonsToRestore[0],
        secondExon: undoMergeExonsChange.exonsToRestore[1],
        parentFeatureId: undoMergeExonsChange.parentFeatureId,
      }))

    return new MergeExonsChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'MergeExonsChange',
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}
