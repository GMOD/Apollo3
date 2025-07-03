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

import { findAndDeleteChildFeature } from './DeleteFeatureChange'
import { UndoMergeExonsChange } from './UndoMergeExonsChange'

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

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this
    for (const change of changes) {
      const { firstExon, secondExon } = change
      const topLevelFeature = await featureModel
        .findOne({ allIds: firstExon._id })
        .session(session)
        .exec()
      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${firstExon._id}'`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      const mergedExon = this.getFeatureFromId(topLevelFeature, firstExon._id)
      if (!mergedExon) {
        const errMsg = 'ERROR when searching feature by featureId'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      mergedExon.min = Math.min(firstExon.min, secondExon.min)
      mergedExon.max = Math.max(firstExon.max, secondExon.max)
      mergedExon.attributes = this.mergeAttributes(firstExon, secondExon)
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

    for (const change of this.changes) {
      const { firstExon, secondExon } = change
      const mergedExon = dataStore.getFeature(firstExon._id)
      if (!mergedExon) {
        throw new Error(
          `Could not find feature with identifier "${firstExon._id}"`,
        )
      }
      mergedExon.setMin(Math.min(firstExon.min, secondExon.min))
      mergedExon.setMax(Math.max(firstExon.max, secondExon.max))
      const mergedAttrs = this.mergeAttributes(firstExon, secondExon)
      mergedExon.setAttributes(new Map())
      for (const key of Object.keys(mergedAttrs)) {
        mergedExon.setAttribute(key, mergedAttrs[key])
      }
      mergedExon.parent?.deleteChild(secondExon._id)
    }
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

  mergeAttributes(
    firstExon: AnnotationFeatureSnapshot,
    secondExon: AnnotationFeatureSnapshot,
  ): Record<string, string[]> {
    let mergedAttrs: Record<string, string[]> = {}
    if (firstExon.attributes) {
      // eslint-disable-next-line unicorn/prefer-structured-clone
      mergedAttrs = JSON.parse(JSON.stringify(firstExon.attributes))
    }

    if (secondExon.attributes) {
      // eslint-disable-next-line unicorn/prefer-structured-clone
      const attrs: Record<string, string[]> = JSON.parse(
        JSON.stringify(secondExon.attributes),
      )
      for (const key of Object.keys(attrs)) {
        if (key === '_id' || key === 'gff_id') {
          continue
        }
        if (!Object.keys(mergedAttrs).includes(key)) {
          mergedAttrs[key] = []
        }
        attrs[key].map((x) => {
          if (!mergedAttrs[key].includes(x)) {
            mergedAttrs[key].push(x)
          }
        })
      }
    }
    return mergedAttrs
  }
}
