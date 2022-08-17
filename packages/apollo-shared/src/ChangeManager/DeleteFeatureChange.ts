import { resolveIdentifier } from 'mobx-state-tree'
import { v4 as uuidv4 } from 'uuid'

import { AnnotationFeatureLocation } from '../BackendDrivers/AnnotationFeature'
import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import {
  FeatureChange,
  GFF3FeatureLineWithFeatureIdAndOptionalRefs,
} from './FeatureChange'
import { generateObjectId } from '..'

interface SerializedDeleteFeatureChangeBase extends SerializedChange {
  typeName: 'DeleteFeatureChange'
}

export interface DeleteFeatureChangeDetails {
  featureId: string
  assemblyId: string
}

interface SerializedDeleteFeatureChangeSingle
  extends SerializedDeleteFeatureChangeBase,
    DeleteFeatureChangeDetails {}

interface SerializedDeleteFeatureChangeMultiple
  extends SerializedDeleteFeatureChangeBase {
  changes: DeleteFeatureChangeDetails[]
}

type SerializedDeleteFeatureChange =
  | SerializedDeleteFeatureChangeSingle
  | SerializedDeleteFeatureChangeMultiple

export class DeleteFeatureChange extends FeatureChange {
  typeName = 'DeleteFeatureChange' as const
  changes: DeleteFeatureChangeDetails[]

  constructor(json: SerializedDeleteFeatureChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedDeleteFeatureChange {
    if (this.changes.length === 1) {
      const [{ featureId }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        featureId,
      }
    }
    return {
      typeName: this.typeName,
      changedIds: this.changedIds,
      assemblyId: this.assemblyId,
      changes: this.changes,
    }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { featureModel, session, refSeqModel } = backend
    const { changes, assemblyId } = this

    // Loop the changes
    for (const change of changes) {
      const { featureId } = change

      // Search feature
      const topLevelFeature = await featureModel
        .findOne({ featureIds: featureId })
        .session(session)
        .exec()
      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }

      this.logger.debug?.(
        `*** Top level featureId: ${JSON.stringify(topLevelFeature.featureId)}`,
      )

      // const topLevelFeatureObject =
      //   topLevelFeature.toObject() as GFF3FeatureLineWithFeatureIdAndOptionalRefs
      // const newFeature = this.getObjectByFeatureId(
      //   topLevelFeatureObject,
      //   featureId,
      // )
      // if (!newFeature) {
      //   throw new Error(
      //     `Feature ID "${featureId}" not found in parent feature "${topLevelFeature.featureId}"`,
      //   )
      // }

      this.logger.debug?.(
        `*** topLevelFeature: ${JSON.stringify(topLevelFeature)}`,
      )

      const test2 = await this.removeFromArrayOfObj(
        topLevelFeature,
        topLevelFeature,
        featureId,
      )
      // const index = topLevelFeature.featureIds.indexOf(featureId, 0)
      // if (index > -1) {
      //   topLevelFeature.featureIds.splice(index, 1)
      // }
      this.logger.debug?.(`*** FEATUREID DELETED: ${JSON.stringify(test2)}`)

      // // Add into Mongo
      // const [newFeatureDoc] = await featureModel.create(
      //   [
      //     {
      //       ...newFeatureLine,
      //       _id: generateObjectId(),
      //       refSeq: refSeqDoc._id,
      //       featureIds,
      //     },
      //   ],
      //   { session },
      // )
      this.logger.debug?.(
        `Deleted feature "${featureId}" from top-level document "${
          topLevelFeature._id
        }", "${typeof topLevelFeature}"`,
      )
    }
  }

  async removeFromArrayOfObj(
    topLevelFeature: any,
    array: any,
    idToRemove: string,
  ) {
    // If feature has child features
    if (array.child_features) {
      for (const [i, e] of array.child_features.entries()) {
        for (const [i2, e2] of e.entries()) {
          // this.logger.debug?.(
          //   `*** CHILD FEATURES SISEMPI i: "${i}", e.featureId: "${e2.featureId}"`,
          // )
          if (e2.featureId === idToRemove) {
            this.logger.debug?.(
              '-----------------------------------------------POISTETAAN-----------------------------------',
            )
            // Let's delete also children's featureIds
            const childrenFeatureIds: string[] = this.getChildrenFeatureIds(
              e2,
              [],
            )
            this.logger.debug?.(`Found ids: ${childrenFeatureIds.toString()}`)
            this.logger.debug?.(
              `Found ids: ${JSON.stringify(childrenFeatureIds)}`,
            )

            array.child_features.splice(i, 1)
            const index = topLevelFeature.featureIds.indexOf(idToRemove, 0)
            if (index > -1) {
              topLevelFeature.featureIds.splice(index, 1)
            }

            // for (featureToDelete of childrenFeatureIds) {
            //   const index = topLevelFeature.featureIds.indexOf(idToRemove, 0)
            //   if (index > -1) {
            //     topLevelFeature.featureIds.splice(index, 1)
            //   }
            // }

            continue
          }
          if (e2.child_features) {
            this.logger.debug?.(
              `*** CHILD FEATURES RECURSIVE: ${JSON.stringify(
                e2.child_features,
              )}`,
            )
            this.removeFromArrayOfObj(
              topLevelFeature,
              e2.child_features,
              idToRemove,
            )
          }
        }
      }
    } else {
      // if (Array.isArray(gff3Item)) {
      // for (const childFeature of feature.child_features || []) {
      //   for (const childFeatureLine of childFeature) {
      // Feature is a leaf i.e. feature has no children
      for (const [i3, e3] of array.entries()) {
        for (const [i4, e4] of e3.entries()) {
          this.logger.debug?.(
            `SISEMPI: i3: ${i3}, e4.featureId: "${e4.featureId}"`,
          )
          if (e4.featureId === idToRemove) {
            this.logger.debug?.(
              '****************************************** POISTETAAN **********************************',
            )
            // Let's delete also children's featureIds
            const childrenFeatureIds: string[] = this.getChildrenFeatureIds(
              e4,
              [],
            )
            this.logger.debug?.(`Found ids: ${childrenFeatureIds.toString()}`)
            array.splice(i3, 1)
            const index = topLevelFeature.featureIds.indexOf(idToRemove, 0)
            if (index > -1) {
              topLevelFeature.featureIds.splice(index, 1)
            }
            continue
          }
          if (e4.child_features) {
            this.logger.debug?.(
              `*** RECURSIVE CALL: ${JSON.stringify(e4.child_features)}`,
            )
            this.removeFromArrayOfObj(
              topLevelFeature,
              e4.child_features,
              idToRemove,
            )
          }
        }
      }
    }
    return array
  }

  getChildrenFeatureIds(parentFeature: any, featureIds: string[]): string[] {
    // if (parentFeature.child_features?.length === 0) {
    //   this.logger.debug?.(
    //     `*** 1 PUSH FEATUREID (no children): ${parentFeature.featureId}`,
    //   )
    //   featureIds.push(parentFeature.featureId)
    //   return featureIds
    // }
    if (!parentFeature.child_features) {
      this.logger.debug?.(
        `*** 2 PUSH FEATUREID (no children): ${parentFeature.featureId}`,
      )
      featureIds.push(parentFeature.featureId)
      return featureIds
    }
    // If there are child features
    if (parentFeature.child_features) {
      for (const childFeature of parentFeature.child_features || []) {
        for (const childFeatureLine of childFeature) {
          // featureIds.push(childFeatureLine.featureId)
          // this.logger.debug?.(
          //   `*** PUSH FEATUREID: ${childFeatureLine.featureId}`,
          // )

          this.getChildrenFeatureIds(childFeatureLine, featureIds)
          // const subFeature = this.getChildrenFeatureIds(
          //   childFeatureLine,
          //   featureIds,
          // )
          // if (subFeature) {
          //   return subFeature
          // }
        }
      }

      // parentFeature.child_features = parentFeature.child_features.map(
      //   (childFeature) =>
      //     childFeature.map((childFeatureLine) => {
      //       const featureId = uuidv4()
      //       featureIdArrAsParam.push(featureId)
      //       const newChildFeature = { ...childFeatureLine, featureId }
      //       this.setAndGetFeatureIdRecursively(
      //         newChildFeature,
      //         featureIdArrAsParam,
      //       )
      //       return newChildFeature
      //     }),
      // )
    }
    return featureIds
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  async applyToClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    this.changedIds.forEach((changedId, idx) => {
      const feature = resolveIdentifier(
        AnnotationFeatureLocation,
        dataStore.features,
        changedId,
      )
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
    })
  }

  getInverse() {
    const inverseChangedIds = this.changedIds.slice().reverse()
    const inverseChanges = this.changes
      .slice()
      .reverse()
      .map((endChange) => ({
        featureId: endChange.featureId,
        assemblyId: endChange.assemblyId,
      }))
    return new DeleteFeatureChange(
      {
        changedIds: inverseChangedIds,
        typeName: this.typeName,
        changes: inverseChanges,
        assemblyId: this.assemblyId,
      },
      { logger: this.logger },
    )
  }
}

export function isDeleteFeatureChange(
  change: unknown,
): change is DeleteFeatureChange {
  return (change as DeleteFeatureChange).typeName === 'DeleteFeatureChange'
}
