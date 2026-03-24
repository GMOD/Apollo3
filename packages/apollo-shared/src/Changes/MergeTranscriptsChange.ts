/* eslint-disable unicorn/prefer-structured-clone */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'
import type {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
} from '@apollo-annotation/mst'
import type { Feature } from '@apollo-annotation/schemas'
import { doesIntersect2 } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { attributesToRecords, stringifyAttributes } from '../util.js'

import { UndoMergeTranscriptsChange } from './UndoMergeTranscriptsChange.js'

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

  mergeTranscriptsOnServer(
    firstTranscript: Feature,
    secondTranscript: AnnotationFeatureSnapshot,
  ) {
    firstTranscript.min = Math.min(firstTranscript.min, secondTranscript.min)
    firstTranscript.max = Math.max(firstTranscript.max, secondTranscript.max)

    const mergedAttributes: Record<string, string[]> =
      firstTranscript.attributes
        ? JSON.parse(JSON.stringify(firstTranscript.attributes))
        : {}
    if (secondTranscript.attributes) {
      if (!Object.keys(mergedAttributes).includes('merged_with')) {
        mergedAttributes.merged_with = []
      }
      mergedAttributes.merged_with.push(
        stringifyAttributes(attributesToRecords(secondTranscript.attributes)),
      )
    }
    firstTranscript.attributes = mergedAttributes

    if (secondTranscript.children) {
      for (const [, secondFeatureChild] of Object.entries(
        secondTranscript.children,
      )) {
        this.mergeFeatureIntoTranscriptOnServer(
          secondFeatureChild,
          firstTranscript,
        )
      }
    }
  }

  mergeFeatureIntoTranscriptOnServer(
    secondFeatureChild: AnnotationFeatureSnapshot,
    firstTranscript: Feature,
  ) {
    if (!firstTranscript.children) {
      firstTranscript.children = new Map<string, Feature>()
    }
    let merged = false
    let mrgChild: Feature | undefined
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
        mrgChild.min = Math.min(
          secondFeatureChild.min,
          mrgChild.min,
          firstFeatureChild.min,
        )
        mrgChild.max = Math.max(
          secondFeatureChild.max,
          mrgChild.max,
          firstFeatureChild.max,
        )

        if (!mrgChild.attributes) {
          mrgChild.attributes = {}
        }

        const mrgChildAttr: Record<string, string[]> = JSON.parse(
          JSON.stringify(mrgChild.attributes),
        )

        if (!Object.keys(mrgChildAttr).includes('merged_with')) {
          mrgChildAttr.merged_with = []
        }
        const mergedWithAttributes = mrgChildAttr.merged_with
        mergedWithAttributes.push(
          stringifyAttributes(
            attributesToRecords(secondFeatureChild.attributes),
          ),
        )

        if (toDelete) {
          const recs: Record<string, string[] | undefined> =
            firstFeatureChild.attributes
              ? JSON.parse(JSON.stringify(firstFeatureChild.attributes))
              : undefined
          mergedWithAttributes.push(stringifyAttributes(recs))
          firstTranscript.children.delete(firstFeatureChild._id.toString())
        }

        mrgChildAttr.merged_with = [...new Set(mergedWithAttributes)]
        mrgChild.attributes = mrgChildAttr
        merged = true
      }
    }

    if (merged && mrgChild && secondFeatureChild.children) {
      // Add the children of the source feature
      // (secondFeatureChild.children) to the merged feature (mrgChild)
      Object.entries(secondFeatureChild.children).map(([, child]) => {
        this.addChild(mrgChild, child)
      })
    }

    if (merged && mrgChild) {
      this.addChild(
        firstTranscript,
        mrgChild as unknown as AnnotationFeatureSnapshot,
      )
    } else {
      // This secondFeatureChild has no overlap with any feature in the
      // receiving transcript so we add it as it is to the receiving transcript
      this.addChild(firstTranscript, secondFeatureChild)
    }
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
    if (!firstTranscript.children) {
      firstTranscript.children = new Map<string, AnnotationFeature>()
    }
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
