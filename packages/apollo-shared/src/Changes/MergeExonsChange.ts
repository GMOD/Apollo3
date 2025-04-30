/* eslint-disable unicorn/prefer-structured-clone */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from '@apollo-annotation/common'
import {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
} from '@apollo-annotation/mst'
import { findAndDeleteChildFeature } from './DeleteFeatureChange'
import { SplitExonChange } from './SplitExonChange'

interface SerializedMergeExonsChangeBase extends SerializedFeatureChange {
  typeName: 'MergeExonsChange'
}

export interface MergeExonsChangeDetails {
  firstExon: AnnotationFeatureSnapshot
  secondExon: AnnotationFeatureSnapshot
  parentFeatureId?: string
  mergedExon: AnnotationFeatureSnapshot
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

  toJSON(): SerializedMergeExonsChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ firstExon, secondExon, parentFeatureId, mergedExon }] = changes

      return {
        typeName,
        changedIds,
        assembly,
        firstExon,
        secondExon,
        parentFeatureId,
        mergedExon,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this
    for (const change of changes) {
      const { firstExon, secondExon, mergedExon } = change
      const topLevelFeature = await featureModel
        .findOne({ allIds: firstExon._id })
        .session(session)
        .exec()
      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${firstExon._id}'`
        logger.error(errMsg)
        throw new Error(errMsg)
      }

      const updatedExon = this.getFeatureFromId(topLevelFeature, firstExon._id)
      if (!updatedExon) {
        const errMsg = 'ERROR when searching feature by featureId'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      updatedExon.min = mergedExon.min
      updatedExon.max = mergedExon.max
      updatedExon.attributes = JSON.parse(
        JSON.stringify(mergedExon.attributes),
      ) as Record<string, string[]>

      const deletedIds = findAndDeleteChildFeature(
        topLevelFeature,
        secondExon._id,
        this,
      )
      deletedIds.push(secondExon._id)
      topLevelFeature.allIds = topLevelFeature.allIds.filter(
        (id) => !deletedIds.includes(id),
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

    for (const [idx, changedId] of this.changedIds.entries()) {
      const { firstExon, secondExon, mergedExon } = this.changes[idx]
      const updatedExon = dataStore.getFeature(firstExon._id)
      if (!updatedExon) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      updatedExon.setMin(mergedExon.min)
      updatedExon.setMax(mergedExon.max)
      const mergedAttrs = JSON.parse(
        JSON.stringify(mergedExon.attributes),
      ) as Record<string, string[]>
      updatedExon.setAttributes(new Map())
      for (const key of Object.keys(mergedAttrs)) {
        updatedExon.setAttribute(key, mergedAttrs[key])
      }
      updatedExon.parent?.deleteChild(secondExon._id)
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes]
      .reverse()
      .map((mergeExonChange) => this.invertChange(mergeExonChange))

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

  invertChange(mergeExonChange: MergeExonsChangeDetails): {
    exonToBeSplit: AnnotationFeatureSnapshot
    parentFeatureId: string | undefined
    upstreamCut: number
    downstreamCut: number
  } {
    let upstreamCut
    let downstreamCut
    if (mergeExonChange.firstExon.max < mergeExonChange.secondExon.min) {
      upstreamCut = mergeExonChange.firstExon.max
      downstreamCut = mergeExonChange.secondExon.min
    } else {
      upstreamCut = mergeExonChange.secondExon.min
      downstreamCut = mergeExonChange.firstExon.max
    }

    const inverseChange = {
      exonToBeSplit: mergeExonChange.mergedExon,
      parentFeatureId: mergeExonChange.parentFeatureId,
      upstreamCut,
      downstreamCut,
    }
    // console.log('inverseChanges:' + JSON.stringify(inverseChange, null, 2))
    return inverseChange
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
