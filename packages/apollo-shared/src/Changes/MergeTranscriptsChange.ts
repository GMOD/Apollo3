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
import { type Feature } from '@apollo-annotation/schemas/src/feature.schema'
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
      this.mergeTranscripts(mergedTranscript, secondTranscript)
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
      this.mergeTranscripts(mergedTranscript, secondTranscript)
      mergedTranscript.parent?.deleteChild(secondTranscript._id)
    }
  }

  /* Merge attributes from source into destination */
  mergeAttributes(
    destination: Feature | AnnotationFeatureSnapshot,
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

  mergeTranscripts(
    firstTranscript: Feature | AnnotationFeature,
    secondTranscript: AnnotationFeatureSnapshot,
  ) {
    if (!firstTranscript.children) {
      firstTranscript.children = new Map<string, AnnotationFeature>()
    }
    if (this.isAnnotationFeature(firstTranscript)) {
      firstTranscript.setMin(
        Math.min(firstTranscript.min, secondTranscript.min),
      )
      firstTranscript.setMax(
        Math.max(firstTranscript.max, secondTranscript.max),
      )
    } else {
      firstTranscript.min = Math.min(firstTranscript.min, secondTranscript.min)
      firstTranscript.max = Math.max(firstTranscript.max, secondTranscript.max)
    }
    if (secondTranscript.children) {
      for (const [, secondFeatureChild] of Object.entries(
        secondTranscript.children,
      )) {
        let merged = false
        let mrgChild: AnnotationFeatureSnapshot | Feature | undefined
        for (const [fKey, firstFeatureChild] of firstTranscript.children) {
          if (!merged || !mrgChild) {
            mrgChild = JSON.parse(JSON.stringify(firstFeatureChild))
          }
          if (
            mrgChild &&
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
            const mergedAttrs = this.mergeAttributes(
              mrgChild,
              secondFeatureChild,
            )
            mrgChild.attributes = mergedAttrs
            if (this.isAnnotationFeature(firstTranscript)) {
              firstTranscript.deleteChild(firstFeatureChild._id as string)
            } else {
              firstTranscript.children?.delete(fKey as string)
            }
            merged = true
          }
        }
        if (this.isAnnotationFeature(firstTranscript)) {
          if (merged && mrgChild) {
            const mrg: AnnotationFeatureSnapshot = JSON.parse(
              JSON.stringify(mrgChild),
            )
            firstTranscript.addChild(mrg)
          } else {
            const ff: AnnotationFeatureSnapshot = JSON.parse(
              JSON.stringify(secondFeatureChild),
            )
            firstTranscript.addChild(ff)
          }
        } else {
          if (merged && mrgChild) {
            const mrg: Feature = JSON.parse(JSON.stringify(mrgChild))
            firstTranscript.children?.set(mrg._id.toString(), mrg)
          } else {
            const ff: Feature = JSON.parse(JSON.stringify(secondFeatureChild))
            firstTranscript.children?.set(ff._id.toString(), ff)
          }
        }
      }
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

  mergeTranscriptsOnClient(
    firstTranscript: AnnotationFeature,
    secondTranscript: AnnotationFeatureSnapshot,
  ) {
    if (!firstTranscript.children) {
      firstTranscript.children = new Map<string, AnnotationFeature>()
    }
    firstTranscript.setMin(Math.min(firstTranscript.min, secondTranscript.min))
    firstTranscript.setMax(Math.max(firstTranscript.max, secondTranscript.max))
    if (secondTranscript.children) {
      for (const [, secondFeatureChild] of Object.entries(
        secondTranscript.children,
      )) {
        let merged = false
        let mrgChild: AnnotationFeatureSnapshot | undefined
        for (const [, firstFeatureChild] of firstTranscript.children) {
          if (!merged || !mrgChild) {
            mrgChild = JSON.parse(JSON.stringify(firstFeatureChild))
          }
          if (
            mrgChild &&
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
            const mergedAttrs = this.mergeAttributes(
              mrgChild,
              secondFeatureChild,
            )
            mrgChild.attributes = mergedAttrs
            firstTranscript.deleteChild(firstFeatureChild._id)
            merged = true
          }
        }
        if (merged && mrgChild) {
          firstTranscript.addChild(mrgChild)
        } else {
          const ff: AnnotationFeatureSnapshot = JSON.parse(
            JSON.stringify(secondFeatureChild),
          )
          firstTranscript.addChild(ff)
        }
      }
    }
  }

  mergeTranscriptsOnServer(
    firstTranscript: Feature,
    secondTranscript: AnnotationFeatureSnapshot,
  ) {
    if (!firstTranscript.children) {
      firstTranscript.children = new Map<string, Feature>()
    }
    firstTranscript.min = Math.min(firstTranscript.min, secondTranscript.min)
    firstTranscript.max = Math.max(firstTranscript.max, secondTranscript.max)
    if (secondTranscript.children) {
      for (const [sKey, secondFeatureChild] of Object.entries(
        secondTranscript.children,
      )) {
        let merged = false
        let mrgChild: Feature | undefined
        for (const [fKey, firstFeatureChild] of firstTranscript.children) {
          if (!merged || !mrgChild) {
            mrgChild = JSON.parse(JSON.stringify(firstFeatureChild))
          }
          if (
            mrgChild &&
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
            const mergedAttrs = this.mergeAttributes(
              mrgChild,
              secondFeatureChild,
            )
            mrgChild.attributes = mergedAttrs
            firstTranscript.children.delete(fKey)
            merged = true
          }
        }
        if (merged && mrgChild) {
          firstTranscript.children.set(sKey, mrgChild)
        } else {
          const ff: Feature = JSON.parse(JSON.stringify(secondFeatureChild))
          firstTranscript.children.set(sKey, ff)
        }
      }
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
