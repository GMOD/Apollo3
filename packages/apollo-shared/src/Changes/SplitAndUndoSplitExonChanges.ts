/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

interface SerializedSplitExonChangeBase extends SerializedFeatureChange {
  typeName: 'SplitExonChange'
}

export interface SplitExonChangeDetails {
  exonToBeSplit: AnnotationFeatureSnapshot
  parentFeatureId: string
  upstreamCut: number
  downstreamCut: number
  leftExonId: string
  rightExonId: string
}

interface SerializedSplitExonChangeSingle
  extends SerializedSplitExonChangeBase,
    SplitExonChangeDetails {}

interface SerializedSplitExonChangeMultiple
  extends SerializedSplitExonChangeBase {
  changes: SplitExonChangeDetails[]
}

export type SerializedSplitExonChange =
  | SerializedSplitExonChangeSingle
  | SerializedSplitExonChangeMultiple

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

export class SplitExonChange extends FeatureChange {
  typeName = 'SplitExonChange' as const
  changes: SplitExonChangeDetails[]

  constructor(json: SerializedSplitExonChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification() {
    return 'Exon successfully split'
  }

  toJSON(): SerializedSplitExonChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [
        {
          exonToBeSplit,
          parentFeatureId,
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
        exonToBeSplit,
        parentFeatureId,
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
    const inverseChanges = [...changes].reverse().map((splitExonChange) => ({
      exonToRestore: splitExonChange.exonToBeSplit,
      parentFeatureId: splitExonChange.parentFeatureId,
      idsToDelete: [splitExonChange.leftExonId, splitExonChange.rightExonId],
      upstreamCut: splitExonChange.upstreamCut,
      downstreamCut: splitExonChange.downstreamCut,
      leftExonId: splitExonChange.leftExonId,
      rightExonId: splitExonChange.rightExonId,
    }))
    logger.debug?.(`INVERSE CHANGE '${JSON.stringify(inverseChanges)}'`)
    return new UndoSplitExonChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'UndoSplitExonChange',
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }

  makeSplitExons(
    exonToBeSplit: AnnotationFeatureSnapshot,
    upstreamCut: number,
    downstreamCut: number,
    leftExonId: string,
    rightExonId: string,
  ): [AnnotationFeatureSnapshot, AnnotationFeatureSnapshot] {
    // eslint-disable-next-line unicorn/prefer-structured-clone
    const exon = JSON.parse(JSON.stringify(exonToBeSplit))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    delete exon.attributes._id
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    delete exon.attributes.gff_id

    const leftExon = structuredClone(
      exon,
    ) as unknown as AnnotationFeatureSnapshot
    leftExon._id = leftExonId
    leftExon.max = upstreamCut

    const rightExon = structuredClone(
      exon,
    ) as unknown as AnnotationFeatureSnapshot
    rightExon.min = downstreamCut
    rightExon._id = rightExonId

    return [leftExon, rightExon]
  }
}

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
