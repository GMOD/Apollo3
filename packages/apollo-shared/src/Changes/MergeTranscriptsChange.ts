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
    this.mergeTranscriptAttributes(firstTranscript, secondTranscript)
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
    for (const [fKey, firstFeatureChild] of firstTranscript.children) {
      if (!merged || !mrgChild) {
        mrgChild = firstFeatureChild
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
        const mergedAttrs = this.mergeAttributes(mrgChild, secondFeatureChild)
        mrgChild.attributes = mergedAttrs
        firstTranscript.children.delete(fKey)
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
    for (const [idx, changedId] of this.changedIds.entries()) {
      const { firstTranscript, secondTranscript } = this.changes[idx]
      const mergedTranscript = dataStore.getFeature(firstTranscript._id)
      if (!mergedTranscript) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
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

    this.mergeTranscriptAttributes(firstTranscript, secondTranscript)

    if (secondTranscript.children) {
      for (const [, secondFeatureChild] of Object.entries(
        secondTranscript.children,
      )) {
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
        mrgChild.setMin(
          Math.min(secondFeatureChild.min, mrgChild.min, firstFeatureChild.min),
        )
        mrgChild.setMax(
          Math.max(secondFeatureChild.max, mrgChild.max, firstFeatureChild.max),
        )

        const mergedAttrs = this.mergeAttributes(mrgChild, secondFeatureChild)
        Object.entries(mergedAttrs).map(([key, value]) => {
          if (mrgChild) {
            mrgChild.setAttribute(key, value)
          }
        })
        if (toDelete) {
          firstTranscript.deleteChild(firstFeatureChild._id)
        }
        merged = true
      }
    }

    if (merged && mrgChild && secondFeatureChild.children) {
      Object.entries(secondFeatureChild.children).map(([, child]) => {
        mrgChild.addChild(child)
      })
    }

    if (!(merged && mrgChild)) {
      // This secondFeatureChild has no overlap with any feature in the
      // receiving transcript so we add it as it is to the receiving transcript
      firstTranscript.addChild(secondFeatureChild)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isAnnotationFeature(obj: any): obj is AnnotationFeature {
    return (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typeof obj.setMin === 'function' &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typeof obj.setMax === 'function' &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typeof obj.addChild === 'function' &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typeof obj.deleteChild === 'function'
    )
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  /* Merge attributes from source into destination */
  mergeAttributes(
    destination: Feature | AnnotationFeature,
    source: AnnotationFeatureSnapshot,
  ): Record<string, string[]> {
    const destAttrs: Record<string, string[]> = destination.attributes
      ? JSON.parse(JSON.stringify(destination.attributes))
      : {}
    if (source.attributes) {
      const sourceAttrs: Record<string, string[]> = JSON.parse(
        JSON.stringify(source.attributes),
      )
      Object.entries(sourceAttrs).map(([key, value]) => {
        if (!(key in destAttrs)) {
          destAttrs[key] = []
        }
        value.map((x) => {
          if (!destAttrs[key].includes(x)) {
            destAttrs[key].push(x)
          }
        })
      })
    }
    return destAttrs
  }

  mergeTranscriptAttributes(
    firstTranscript: Feature | AnnotationFeature,
    secondTranscript: AnnotationFeatureSnapshot,
  ) {
    const txAttrs = this.mergeAttributes(firstTranscript, secondTranscript)
    if (this.isAnnotationFeature(firstTranscript)) {
      Object.entries(txAttrs).map(([key, value]) => {
        firstTranscript.setAttribute(key, value)
      })
    } else {
      firstTranscript.attributes = txAttrs
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
}
