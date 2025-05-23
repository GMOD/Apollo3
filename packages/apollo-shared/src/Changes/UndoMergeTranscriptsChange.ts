/* eslint-disable @typescript-eslint/require-await */

import {
  type ChangeOptions,
  type ClientDataStore,
  FeatureChange,
  type LocalGFF3DataStore,
  type SerializedFeatureChange,
  type ServerDataStore,
} from '@apollo-annotation/common'
import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

import { MergeTranscriptsChange } from './MergeTranscriptsChange'

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

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes } = this
    for (const change of changes) {
      const { transcriptsToRestore, parentFeatureId } = change
      if (transcriptsToRestore.length !== 2) {
        throw new Error(
          `Expected exactly two transcripts to restore. Got :${transcriptsToRestore.length}`,
        )
      }
      const topLevelFeature = await featureModel
        .findOne({ allIds: parentFeatureId })
        .session(session)
        .exec()
      if (!topLevelFeature) {
        throw new Error(`Could not find feature with ID "${parentFeatureId}"`)
      }
      const parentFeature = this.getFeatureFromId(
        topLevelFeature,
        parentFeatureId,
      )
      if (!parentFeature) {
        throw new Error(
          `Could not find feature with ID "${parentFeatureId}" in feature "${topLevelFeature._id.toString()}"`,
        )
      }
      if (!parentFeature.children) {
        parentFeature.children = new Map()
      }
      for (const transcript of transcriptsToRestore) {
        this.addChild(parentFeature, transcript)
        const childIds = this.getChildFeatureIds(transcript)
        topLevelFeature.allIds.push(transcript._id, ...childIds)
      }
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
    const { changes } = this
    for (const change of changes) {
      const { transcriptsToRestore, parentFeatureId } = change
      if (!parentFeatureId) {
        throw new Error('Parent ID is missing')
      }
      const parentFeature = dataStore.getFeature(parentFeatureId)
      if (!parentFeature) {
        throw new Error(`Could not find parent feature "${parentFeatureId}"`)
      }
      // create an ID for the parent feature if it does not have one
      if (!parentFeature.attributes.get('_id')) {
        parentFeature.setAttribute('_id', [parentFeature._id])
      }
      for (const transcript of transcriptsToRestore) {
        parentFeature.addChild(transcript)
      }
    }
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
