import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

import { UndoMergeExonsChange } from './UndoMergeExonsChange.js'

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
