/* eslint-disable unicorn/prefer-structured-clone */
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
import {
  type AnnotationFeature,
  type AnnotationFeatureSnapshot,
} from '@apollo-annotation/mst'
import { type Feature } from '@apollo-annotation/schemas'
import { doesIntersect2 } from '@jbrowse/core/util'
import { getSnapshot } from 'mobx-state-tree'

import { attributesToRecords, stringifyAttributes } from '../util'

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
      this.mergeTranscriptsOnServer(mergedTranscript, secondTranscript)
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

  /* --------------------------------- */

  async executeOnClient(dataStore: ClientDataStore) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!dataStore) {
      throw new Error('No data store')
    }
    console.log('changedIds ' + JSON.stringify(this.changedIds))
    for (const [idx, changedId] of this.changedIds.entries()) {
      const { firstTranscript, secondTranscript } = this.changes[idx]
      const mergedTranscript = dataStore.getFeature(firstTranscript._id)
      if (!mergedTranscript) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      console.log('IDX ' + idx.toString() + ' changeId ' + changedId)
      console.log(
        'mergedTranscript ' + JSON.stringify(mergedTranscript, null, 2),
      )
      this.mergeTranscriptsOnClient(mergedTranscript, secondTranscript)
      mergedTranscript.parent?.deleteChild(secondTranscript._id)
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
        console.log(
          'firstTranscript ' + JSON.stringify(firstTranscript, null, 2),
        )
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
    console.log(
      'secondFeatureChild ' + JSON.stringify(secondFeatureChild, null, 2),
    )
    for (const [, firstFeatureChild] of firstTranscript.children) {
      if (!merged || !mrgChild) {
        toDelete = false
        mrgChild = firstFeatureChild
      } else {
        toDelete = true
      }
      console.log('mrgChild ' + JSON.stringify(mrgChild, null, 2))
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

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
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
