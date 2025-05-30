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
import { Feature } from '@apollo-annotation/schemas'
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
      mergedTranscript.min = Math.min(firstTranscript.min, secondTranscript.min)
      mergedTranscript.max = Math.max(firstTranscript.max, secondTranscript.max)

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

      if (secondTranscript.children) {
        for (const [, child] of Object.entries(secondTranscript.children)) {
          let merged = false
          if (mergedTranscript.children) {
            for (const [, mrgChild] of mergedTranscript.children) {
              if (
                mrgChild.type === child.type &&
                doesIntersect2(child.min, child.max, mrgChild.min, mrgChild.max)
              ) {
                mrgChild.setMin(Math.min(child.min, mrgChild.min))
                mrgChild.setMax(Math.max(child.max, mrgChild.max))
                this.mergeAttributes(mrgChild, child)
                merged = true
              }
              if (merged) {
                break
              }
            }
          }
          if (!merged) {
            mergedTranscript.addChild(child)
          }
        }
      }
      mergedTranscript.parent?.deleteChild(secondTranscript._id)
    }
  }

  mergeTranscriptsOnServer(
    mergedTranscript: Feature,
    secondTranscript: AnnotationFeatureSnapshot,
  ) {
    if (!mergedTranscript.children) {
      mergedTranscript.children = new Map<string, Feature>()
    }
    mergedTranscript.min = Math.min(mergedTranscript.min, secondTranscript.min)
    mergedTranscript.max = Math.min(mergedTranscript.max, secondTranscript.max)
    if (secondTranscript.children) {
      for (const [sKey, secondFeatureChild] of Object.entries(
        secondTranscript.children,
      )) {
        let merged = false
        let mrgChild: Feature | undefined
        for (const [fKey, firstFeatureChild] of mergedTranscript.children) {
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
            this.mergeAttributes(mrgChild, secondFeatureChild)

            // if (firstFeatureChild.attributes) {
            //   if (!mrgChild.attributes) {
            //     mrgChild.attributes = firstFeatureChild.attributes
            //   } else {
            //     for (const [key, value] of Object.entries(firstFeatureChild.attributes)) {
            //       if (key in mrgChild.attributes) {

            //       }
            //     }
            //   }
            // }
            mergedTranscript.children.delete(fKey)
            merged = true
          }
        }
        if (merged && mrgChild) {
          mergedTranscript.children.set(sKey, mrgChild)
        } else {
          const ff: Feature = JSON.parse(JSON.stringify(secondFeatureChild))
          mergedTranscript.children.set(sKey, ff)
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

  /* Merge attributes from source into destination */
  mergeAttributes(
    destination: Feature | AnnotationFeature,
    source: Feature | AnnotationFeature | AnnotationFeatureSnapshot,
  ) {
    if (!source.attributes) {
      return
    }
    const destAttrs: Record<string, string[]> = destination.attributes
      ? JSON.parse(JSON.stringify(destination.attributes))
      : {}
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
    if (destination instanceof Feature) {
      destination.attributes = destAttrs
    }
    //else {
    //  Object.entries(destAttrs).map(([k, v]) => {
    //    destination.setAttribute(k, v)
    //  })
    // }
  }

  // mergeAttributesOnClient(
  //   mergedFeature: AnnotationFeature,
  //   secondFeature: AnnotationFeatureSnapshot,
  // ) {
  //   if (!secondFeature.attributes) {
  //     return
  //   }
  //   const secondAttrs: Record<string, string[]> = JSON.parse(
  //     JSON.stringify(secondFeature.attributes),
  //   )

  //   for (const key of Object.keys(secondAttrs)) {
  //     if (key === '_id' || key === 'gff_id') {
  //       continue
  //     }

  //     const mergedAttr: string[] = mergedFeature.attributes.get(key)
  //       ? JSON.parse(JSON.stringify(mergedFeature.attributes.get(key)))
  //       : []
  //     secondAttrs[key].map((x) => {
  //       if (!mergedAttr.includes(x)) {
  //         mergedAttr.push(x)
  //       }
  //     })
  //     mergedFeature.setAttribute(key, mergedAttr)
  //   }
  // }

  // mergeAttributesOnServer(
  //   mergedFeature: Feature,
  //   secondFeature: AnnotationFeatureSnapshot,
  // ) {
  //   let mergedAttrs: Record<string, string[]> = {}
  //   if (mergedFeature.attributes) {
  //     mergedAttrs = JSON.parse(JSON.stringify(mergedFeature.attributes))
  //   }

  //   if (!mergedFeature.attributes) {
  //     mergedFeature.attributes = {}
  //   }
  //   if (secondFeature.attributes) {
  //     const attrs: Record<string, string[]> = JSON.parse(
  //       JSON.stringify(secondFeature.attributes),
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
  //     mergedFeature.attributes = mergedAttrs
  //   }
  // }

  // mergeAttributes(
  //   firstTranscript: AnnotationFeatureSnapshot,
  //   secondTranscript: AnnotationFeatureSnapshot,
  // ): Record<string, string[]> {
  //   let mergedAttrs: Record<string, string[]> = {}
  //   if (firstTranscript.attributes) {
  //     mergedAttrs = JSON.parse(JSON.stringify(firstTranscript.attributes))
  //   }

  //   if (secondTranscript.attributes) {
  //     const attrs: Record<string, string[]> = JSON.parse(
  //       JSON.stringify(secondTranscript.attributes),
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
