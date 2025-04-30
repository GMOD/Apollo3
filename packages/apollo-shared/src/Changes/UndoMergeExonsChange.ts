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
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

interface SerializedUndoMergeExonsChangeBase extends SerializedFeatureChange {
  typeName: 'UndoMergeExonsChange'
}

export interface UndoMergeExonsChangeDetails {
  exonsToRestore: AnnotationFeatureSnapshot[]
  parentFeatureId?: string
  idsToDelete?: string[]
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
      const [{ exonsToRestore, parentFeatureId, idsToDelete }] = changes

      return {
        typeName,
        changedIds,
        assembly,
        exonsToRestore,
        parentFeatureId,
        idsToDelete,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes } = this
    for (const change of changes) {
      const { exonsToRestore, parentFeatureId, idsToDelete } = change
      if (!parentFeatureId) {
        throw new Error('Missing parent ID')
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
      for (const exon of exonsToRestore) {
        if (!parentFeature.attributes?._id) {
          let { attributes } = parentFeature
          if (!attributes) {
            attributes = {}
          }
          attributes = {
            _id: [parentFeature._id.toString()],
            // eslint-disable-next-line unicorn/prefer-structured-clone
            ...JSON.parse(JSON.stringify(attributes)),
          }
          parentFeature.attributes = attributes
        }
        const { _id } = exon
        parentFeature.children.set(_id, {
          allIds: [],
          ...exon,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          _id,
        })
        // Child features should be sorted for click and drag of gene glyphs to work properly
        parentFeature.children = new Map(
          [...parentFeature.children.entries()].sort(
            (a, b) => a[1].min - b[1].min,
          ),
        )
        const childIds = this.getChildFeatureIds(exon)
        topLevelFeature.allIds.push(_id, ...childIds)
      }
      if (idsToDelete) {
        topLevelFeature.allIds = topLevelFeature.allIds.filter(
          (id) => !idsToDelete.includes(id),
        )
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
      const { exonsToRestore, parentFeatureId, idsToDelete } = change
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
      for (const exon of exonsToRestore) {
        parentFeature.addChild(exon)
      }
      if (idsToDelete) {
        idsToDelete.map((id) => {
          parentFeature.deleteChild(id)
        })
      }
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes]
      .reverse()
      .map((UndoMergeExonsChange) => ({
        exonsToRestore: UndoMergeExonsChange.exonsToRestore,
        parentFeatureId: UndoMergeExonsChange.parentFeatureId,
      }))

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
}
