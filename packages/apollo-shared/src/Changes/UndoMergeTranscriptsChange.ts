import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

import { MergeTranscriptsChange } from './MergeTranscriptsChange.js'

interface SerializedUndoMergeTranscriptsChangeBase
  extends SerializedFeatureChange {
  typeName: 'UndoMergeTranscriptsChange'
}

export interface UndoMergeTranscriptsChangeDetails {
  transcriptsToRestore: AnnotationFeatureSnapshot[]
  parentFeatureId: string
}

interface SerializedUndoMergeTranscriptsChangeSingle
  extends SerializedUndoMergeTranscriptsChangeBase,
    UndoMergeTranscriptsChangeDetails {}

interface SerializedUndoMergeTranscriptsChangeMultiple
  extends SerializedUndoMergeTranscriptsChangeBase {
  changes: UndoMergeTranscriptsChangeDetails[]
}

export type SerializedUndoMergeTranscriptsChange =
  | SerializedUndoMergeTranscriptsChangeSingle
  | SerializedUndoMergeTranscriptsChangeMultiple
export class UndoMergeTranscriptsChange extends FeatureChange {
  typeName = 'UndoMergeTranscriptsChange' as const
  changes: UndoMergeTranscriptsChangeDetails[]

  constructor(
    json: SerializedUndoMergeTranscriptsChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedUndoMergeTranscriptsChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ transcriptsToRestore, parentFeatureId }] = changes

      return {
        typeName,
        changedIds,
        assembly,
        transcriptsToRestore,
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
      .map((undoMergeTranscriptsChange) => ({
        firstTranscript: undoMergeTranscriptsChange.transcriptsToRestore[0],
        secondTranscript: undoMergeTranscriptsChange.transcriptsToRestore[1],
        parentFeatureId: undoMergeTranscriptsChange.parentFeatureId,
      }))

    return new MergeTranscriptsChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'MergeTranscriptsChange',
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}
