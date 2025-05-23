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
import { UndoMergeTranscriptsChange } from './UndoMergeTranscriptsChange'

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

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this
    for (const change of changes) {
      const { firstTranscript, secondTranscript } = change
      const topLevelFeature = await featureModel
        .findOne({ allIds: firstTranscript._id })
        .session(session)
        .exec()
      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${firstTranscript._id}'`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      const mergedTranscript = this.getFeatureFromId(
        topLevelFeature,
        firstTranscript._id,
      )
      if (!mergedTranscript) {
        const errMsg = 'ERROR when searching feature by featureId'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      mergedTranscript.min = Math.min(firstTranscript.min, secondTranscript.min)
      mergedTranscript.max = Math.max(firstTranscript.max, secondTranscript.max)
      mergedTranscript.attributes = this.mergeAttributes(
        firstTranscript,
        secondTranscript,
      )
      const deletedIds = findAndDeleteChildFeature(
        topLevelFeature,
        secondTranscript._id,
        this,
      )
      deletedIds.push(secondTranscript._id)
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
      const { firstTranscript, secondTranscript } = this.changes[idx]
      const mergedTranscript = dataStore.getFeature(firstTranscript._id)
      if (!mergedTranscript) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      mergedTranscript.setMin(
        Math.min(firstTranscript.min, secondTranscript.min),
      )
      mergedTranscript.setMax(
        Math.max(firstTranscript.max, secondTranscript.max),
      )
      const mergedAttrs = this.mergeAttributes(
        firstTranscript,
        secondTranscript,
      )
      mergedTranscript.setAttributes(new Map())
      for (const key of Object.keys(mergedAttrs)) {
        mergedTranscript.setAttribute(key, mergedAttrs[key])
      }
      mergedTranscript.parent?.deleteChild(secondTranscript._id)
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

  mergeAttributes(
    firstTranscript: AnnotationFeatureSnapshot,
    secondTranscript: AnnotationFeatureSnapshot,
  ): Record<string, string[]> {
    let mergedAttrs: Record<string, string[]> = {}
    if (firstTranscript.attributes) {
      // eslint-disable-next-line unicorn/prefer-structured-clone
      mergedAttrs = JSON.parse(JSON.stringify(firstTranscript.attributes))
    }

    if (secondTranscript.attributes) {
      // eslint-disable-next-line unicorn/prefer-structured-clone
      const attrs: Record<string, string[]> = JSON.parse(
        JSON.stringify(secondTranscript.attributes),
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
