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

      // const test2 = await this.removeFromArrayOfObj ( topLevelFeature.child_features, featureId)
      const test2 = await this.removeFromArrayOfObj(topLevelFeature, featureId)
      this.logger.debug?.(`*** 22 WITHOUT featureId: ${JSON.stringify(test2)}`)

      // const newFeatureId = uuidv4() // Set new featureId in target assembly
      // const featureIds = [newFeatureId]
      // newFeature.featureId = newFeatureId // Set new featureId in top level

      // const refSeqDoc = await refSeqModel
      //   .findOne({ assembly: targetAssemblyId, name: newFeature.seq_id })
      //   .session(session)
      //   .exec()
      // if (!refSeqDoc) {
      //   throw new Error(
      //     `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${topLevelFeature.seq_id}" not found`,
      //   )
      // }

      // // Let's add featureId to each child recursively
      // const newFeatureLine = this.setAndGetFeatureIdRecursively(
      //   newFeature,
      //   featureIds,
      // )
      // this.logger.verbose?.(`New featureIds: ${featureIds}`)
      // this.logger.verbose?.(`New assemblyId: ${targetAssemblyId}`)
      // this.logger.verbose?.(`New refSeqId: ${refSeqDoc._id}`)
      // this.logger.verbose?.(`New featureId: ${newFeatureLine.featureId}`)

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

  //   async recursiveRemove ( list: any, id: string ) {
  //     return list
  //       .map((item: any) => {
  //         return { ...item }
  //       })
  //       .filter((item: any) => {
  //         if ( 'child_features' in item ) {
  //           this.logger.debug?.(
  //             `*** RECURSIVE: ${JSON.stringify(item.child_features)}`,
  //           )
  //             item.child_features = this.recursiveRemove ( item.child_features, id );
  //         }
  //         return item.featureId !== id;
  //     });
  // }

  async removeFromArrayOfObj(array: any, idToRemove: string) {
    // If there are child features
    if (array.child_features) {
      for (const [i, e] of array.child_features.entries()) {
        for (const [i2, e2] of e.entries()) {
          // this.logger.debug?.(
          //   `+++ removeFromArrayOfObj e: ${JSON.stringify(e2)}`,
          // )
          this.logger.debug?.(
            `*** removeFromArrayOfObj i2: "${i2}", e.featureId: "${e2.featureId}"`,
          )
          if (e2.featureId === idToRemove) {
            this.logger.debug?.('POISTETAAN!!!!')
            e2.splice(i2, 1)
            continue
          }
          if (e2.child_features) {
            this.logger.debug?.(
              `*** removeFromArrayOfObj RECURSIVE: ${JSON.stringify(
                e2.child_features,
              )}`,
            )
            this.removeFromArrayOfObj(e2.child_features, idToRemove)
          }
        }
      }
    } else {
      let ind = 0
      for (const [i3, e3] of array.entries()) {
        this.logger.debug?.(
          `ULOMPI: i3: ${i3}, e3.featureId: "${e3.featureId}"`,
        )
        for (const [i4, e4] of e3.entries()) {
          // this.logger.debug?.(
          //   `+++4444 removeFromArrayOfObj i4: "${i4}", e4: ${JSON.stringify(
          //     e4,
          //   )}`,
          // )
          this.logger.debug?.(
            `SISEMPI: index: ${ind}, i3: ${i3}, i4: ${i4}, e4.featureId: "${e4.featureId}"`,
          )
          if (e4.featureId === idToRemove) {
            this.logger.debug?.(
              '****************************************** POISTETAAN **********************************',
            )
            // e3.splice(i4, 1)
            array.splice(ind, 1)
            continue
          }
          if (e4.child_features) {
            this.logger.debug?.(
              `*** RECURSIVE CALL: ${JSON.stringify(e4.child_features)}`,
            )
            this.removeFromArrayOfObj(e4.child_features, idToRemove)
          }
        }
        ind++
      }
    }

    // for (const [i, e] of array.entries()) {
    //   this.logger.debug?.(
    //     `+++ removeFromArrayOfObj i: "${i}", e: ${JSON.stringify(e)}`,
    //   )
    //   this.logger.debug?.(
    //     `--- removeFromArrayOfObj idToRemove: "${idToRemove}",e.featureId: "${
    //       e.featureId
    //     }", e: ${JSON.stringify(e[0])}`,
    //   )
    //   // if (e.featureId === idToRemove) {
    //   if (i === 4) {
    //     this.logger.debug?.('POISTETAAN!!!!')
    //     array.splice(i, 1)
    //     continue
    //   }
    //   if (e.child_features) {
    //     this.logger.debug?.(
    //       `*** removeFromArrayOfObj RECURSIVE: ${JSON.stringify(
    //         e.child_features,
    //       )}`,
    //     )
    //     this.removeFromArrayOfObj(e.child_features, idToRemove)
    //   }
    // }
    return array
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
