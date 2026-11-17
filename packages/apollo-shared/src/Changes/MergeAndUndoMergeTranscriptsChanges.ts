import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'
import type {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
} from '@apollo-annotation/mst'
import { doesIntersect2 } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { attributesToRecords, stringifyAttributes } from '../util.js'

interface SerializedMergeTranscriptsChangeBase extends SerializedFeatureChange {
  typeName: 'MergeTranscriptsChange'
}

export interface MergeTranscriptsChangeDetails {
  firstTranscript: AnnotationFeatureSnapshot
  secondTranscript: AnnotationFeatureSnapshot
  parentFeatureId: string
}

interface SerializedMergeTranscriptsChangeSingle
  extends SerializedMergeTranscriptsChangeBase,
    MergeTranscriptsChangeDetails {}

interface SerializedMergeTranscriptsChangeMultiple
  extends SerializedMergeTranscriptsChangeBase {
  changes: MergeTranscriptsChangeDetails[]
}

export type SerializedMergeTranscriptsChange =
  | SerializedMergeTranscriptsChangeSingle
  | SerializedMergeTranscriptsChangeMultiple

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

export class MergeTranscriptsChange extends FeatureChange {
  typeName = 'MergeTranscriptsChange' as const
  changes: MergeTranscriptsChangeDetails[]

  constructor(json: SerializedMergeTranscriptsChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification() {
    return 'Transcripts successfully merged'
  }

  toJSON(): SerializedMergeTranscriptsChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ firstTranscript, secondTranscript, parentFeatureId }] = changes

      return {
        typeName,
        changedIds,
        assembly,
        firstTranscript,
        secondTranscript,
        parentFeatureId,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  mergeTranscriptsOnClient(
    firstTranscript: AnnotationFeature,
    secondTranscript: AnnotationFeatureSnapshot,
  ) {
    firstTranscript.setMin(Math.min(firstTranscript.min, secondTranscript.min))
    firstTranscript.setMax(Math.max(firstTranscript.max, secondTranscript.max))

    const mrg = firstTranscript.attributes.get('merged_with')?.slice() ?? []
    const mergedWith = stringifyAttributes(
      attributesToRecords(secondTranscript.attributes),
    )

    if (!mrg.includes(mergedWith)) {
      // executeOnClient runs twice (?!) so avoid adding this key again
      mrg.push(mergedWith)
    }
    firstTranscript.setAttribute('merged_with', mrg)

    if (secondTranscript.children) {
      for (const [, secondFeatureChild] of Object.entries(
        secondTranscript.children,
      )) {
        this.mergeFeatureIntoTranscriptOnClient(
          secondFeatureChild,
          firstTranscript,
        )
      }
    }
  }

  mergeFeatureIntoTranscriptOnClient(
    secondFeatureChild: AnnotationFeatureSnapshot,
    firstTranscript: AnnotationFeature,
  ) {
    firstTranscript.children ??= new Map<string, AnnotationFeature>()
    let merged = false
    let mrgChild: AnnotationFeature | undefined
    let toDelete
    for (const [, firstFeatureChild] of firstTranscript.children) {
      if (!merged || !mrgChild) {
        toDelete = false
        mrgChild = firstFeatureChild
      } else {
        toDelete = true
      }
      if (
        mrgChild.type === secondFeatureChild.type &&
        mrgChild.type === firstFeatureChild.type &&
        doesIntersect2(
          secondFeatureChild.min,
          secondFeatureChild.max,
          mrgChild.min,
          mrgChild.max,
        ) &&
        doesIntersect2(
          firstFeatureChild.min,
          firstFeatureChild.max,
          mrgChild.min,
          mrgChild.max,
        )
      ) {
        mrgChild.setMin(
          Math.min(secondFeatureChild.min, mrgChild.min, firstFeatureChild.min),
        )
        mrgChild.setMax(
          Math.max(secondFeatureChild.max, mrgChild.max, firstFeatureChild.max),
        )

        const mergedWithAttributes =
          mrgChild.attributes.get('merged_with')?.slice() ?? []
        mergedWithAttributes.push(
          stringifyAttributes(
            attributesToRecords(secondFeatureChild.attributes),
          ),
        )
        if (toDelete) {
          mergedWithAttributes.push(
            stringifyAttributes(getSnapshot(firstFeatureChild).attributes),
          )
          firstTranscript.deleteChild(firstFeatureChild._id)
        }
        mrgChild.setAttribute('merged_with', [...new Set(mergedWithAttributes)])
        merged = true
      }
    }

    if (merged && mrgChild && secondFeatureChild.children) {
      Object.entries(secondFeatureChild.children).map(([, child]) => {
        mrgChild.addChild(child)
      })
    }

    if (merged && mrgChild) {
      firstTranscript.addChild(getSnapshot(mrgChild))
    } else {
      // This secondFeatureChild has no overlap with any feature in the
      // receiving transcript so we add it as it is to the receiving transcript
      firstTranscript.addChild(secondFeatureChild)
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes]
      .reverse()
      .map((mergeTranscriptChange) => ({
        transcriptsToRestore: [
          mergeTranscriptChange.firstTranscript,
          mergeTranscriptChange.secondTranscript,
        ],
        parentFeatureId: mergeTranscriptChange.parentFeatureId,
      }))
    logger.debug?.(`INVERSE CHANGE '${JSON.stringify(inverseChanges)}'`)
    return new UndoMergeTranscriptsChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'UndoMergeTranscriptsChange',
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}

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
