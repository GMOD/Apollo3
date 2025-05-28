/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  type ChangeOptions,
  type ClientDataStore,
  FeatureChange,
  type LocalGFF3DataStore,
  type SerializedFeatureChange,
  type ServerDataStore,
} from '@apollo-annotation/common'
import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

import { UndoSplitExonChange } from './UndoSplitExonChange'

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
export class SplitExonChange extends FeatureChange {
  typeName = 'SplitExonChange' as const
  changes: SplitExonChangeDetails[]

  constructor(json: SerializedSplitExonChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
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

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this
    for (const change of changes) {
      const {
        exonToBeSplit,
        parentFeatureId,
        upstreamCut,
        downstreamCut,
        leftExonId,
        rightExonId,
      } = change
      const topLevelFeature = await featureModel
        .findOne({ allIds: exonToBeSplit._id })
        .session(session)
        .exec()
      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${exonToBeSplit._id}'`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      const tx = this.getFeatureFromId(topLevelFeature, parentFeatureId)
      if (!tx?.children) {
        throw new Error(
          'ERROR: There should be at least one child (i.e. the exon to be split)',
        )
      }

      const [leftExon, rightExon] = this.makeSplitExons(
        exonToBeSplit,
        upstreamCut,
        downstreamCut,
        leftExonId,
        rightExonId,
      )

      tx.children.set(leftExon._id, {
        allIds: [],
        ...leftExon,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        _id: leftExon._id,
      })
      tx.children.set(rightExon._id, {
        allIds: [],
        ...rightExon,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        _id: rightExon._id,
      })
      // Child features should be sorted for click and drag of gene glyphs to work properly
      tx.children = new Map(
        [...tx.children.entries()].sort((a, b) => a[1].min - b[1].min),
      )

      const deletedIds = this.findAndDeleteChildFeature(
        topLevelFeature,
        exonToBeSplit._id,
      )
      deletedIds.push(exonToBeSplit._id)
      topLevelFeature.allIds = topLevelFeature.allIds.filter(
        (id) => !deletedIds.includes(id),
      )
      topLevelFeature.allIds.push(leftExon._id, rightExon._id)
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

    for (const change of this.changes) {
      const {
        exonToBeSplit,
        parentFeatureId,
        upstreamCut,
        downstreamCut,
        leftExonId,
        rightExonId,
      } = change
      if (!parentFeatureId) {
        throw new Error('TODO: Split exon without parent')
      }

      const [leftExon, rightExon] = this.makeSplitExons(
        exonToBeSplit,
        upstreamCut,
        downstreamCut,
        leftExonId,
        rightExonId,
      )

      const parentFeature = dataStore.getFeature(parentFeatureId)
      if (!parentFeature) {
        throw new Error(`Could not find parent feature "${parentFeatureId}"`)
      }

      parentFeature.addChild(leftExon)
      parentFeature.addChild(rightExon)
      if (dataStore.getFeature(exonToBeSplit._id)) {
        dataStore.deleteFeature(exonToBeSplit._id)
      }
    }
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
  ): AnnotationFeatureSnapshot[] {
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
