import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

interface SerializedMergeExonsChangeBase extends SerializedFeatureChange {
  typeName: 'MergeExonsChange'
}

export interface MergeExonsChangeDetails {
  firstExon: AnnotationFeatureSnapshot
  secondExon: AnnotationFeatureSnapshot
  parentFeatureId: string
}

interface SerializedMergeExonsChangeSingle
  extends SerializedMergeExonsChangeBase,
    MergeExonsChangeDetails {}

interface SerializedMergeExonsChangeMultiple
  extends SerializedMergeExonsChangeBase {
  changes: MergeExonsChangeDetails[]
}

export type SerializedMergeExonsChange =
  | SerializedMergeExonsChangeSingle
  | SerializedMergeExonsChangeMultiple

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

export class MergeExonsChange extends FeatureChange {
  typeName = 'MergeExonsChange' as const
  changes: MergeExonsChangeDetails[]

  constructor(json: SerializedMergeExonsChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification() {
    return 'Exons successfully merged'
  }

  toJSON(): SerializedMergeExonsChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ firstExon, secondExon, parentFeatureId }] = changes

      return {
        typeName,
        changedIds,
        assembly,
        firstExon,
        secondExon,
        parentFeatureId,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((mergeExonChange) => ({
      exonsToRestore: [mergeExonChange.firstExon, mergeExonChange.secondExon],
      parentFeatureId: mergeExonChange.parentFeatureId,
    }))
    logger.debug?.(`INVERSE CHANGE '${JSON.stringify(inverseChanges)}'`)
    return new UndoMergeExonsChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'UndoMergeExonsChange',
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }

  // mergeAttributes(
  //   firstExon: AnnotationFeatureSnapshot,
  //   secondExon: AnnotationFeatureSnapshot,
  // ): Record<string, string[]> {
  //   let mergedAttrs: Record<string, string[]> = {}
  //   if (firstExon.attributes) {
  //     // eslint-disable-next-line unicorn/prefer-structured-clone
  //     mergedAttrs = JSON.parse(JSON.stringify(firstExon.attributes))
  //   }

  //   if (secondExon.attributes) {
  //     // eslint-disable-next-line unicorn/prefer-structured-clone
  //     const attrs: Record<string, string[]> = JSON.parse(
  //       JSON.stringify(secondExon.attributes),
  //     )
  //     for (const key of Object.keys(attrs)) {
  //       if (key === '_id' || key === 'gff_id') {
  //         continue
  //       }
  //       if (!Object.keys(mergedAttrs).includes(key)) {
  //         mergedAttrs[key] = []
  //       }
  //       attrs[key].map((x) => {
  //         if (!mergedAttrs[key].includes(x)) {
  //           mergedAttrs[key].push(x)
  //         }
  //       })
  //     }
  //   }
  //   return mergedAttrs
  // }
}

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
