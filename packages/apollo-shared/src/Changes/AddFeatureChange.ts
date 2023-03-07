import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from 'apollo-common'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import ObjectID from 'bson-objectid'
import { ObjectId, Types } from 'mongoose'

import { DeleteFeatureChange } from './DeleteFeatureChange'

interface SerializedAddFeatureChangeBase extends SerializedFeatureChange {
  typeName: 'AddFeatureChange'
}

export interface AddFeatureChangeDetails {
  addedFeature: AnnotationFeatureSnapshot
  parentFeatureId?: string // Parent feature to where feature will be added
  originalFeatureId?: string // Original featureId in case of copying feature from one assembly to another
  copyFeature?: boolean // Are we copying or adding a new child feature
}

interface SerializedAddFeatureChangeSingle
  extends SerializedAddFeatureChangeBase,
    AddFeatureChangeDetails {}

interface SerializedAddFeatureChangeMultiple
  extends SerializedAddFeatureChangeBase {
  changes: AddFeatureChangeDetails[]
}

type SerializedAddFeatureChange =
  | SerializedAddFeatureChangeSingle
  | SerializedAddFeatureChangeMultiple

export class AddFeatureChange extends FeatureChange {
  typeName = 'AddFeatureChange' as const
  changes: AddFeatureChangeDetails[]

  constructor(json: SerializedAddFeatureChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedAddFeatureChange {
    const { changes, changedIds, typeName, assembly } = this
    if (changes.length === 1) {
      const [
        { addedFeature, parentFeatureId, originalFeatureId, copyFeature },
      ] = changes
      return {
        typeName,
        changedIds,
        assembly,
        addedFeature,
        parentFeatureId,
        originalFeatureId,
        copyFeature,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async executeOnServer(backend: ServerDataStore) {
    const { assemblyModel, featureModel, refSeqModel, session } = backend
    const { changes, assembly, logger } = this

    const assemblyDoc = await assemblyModel
      .findById(assembly)
      .session(session)
      .exec()
    if (!assemblyDoc) {
      const errMsg = `*** ERROR: Assembly with id "${assembly}" not found`
      logger.error(errMsg)
      throw new Error(errMsg)
    }

    let featureCnt = 0
    logger.debug?.(`changes: ${JSON.stringify(changes)}`)

    // Loop the changes
    for (const change of changes) {
      logger.debug?.(`change: ${JSON.stringify(change)}`)
      const { addedFeature, parentFeatureId, copyFeature, originalFeatureId } =
        change
      const { refSeq } = addedFeature
      const refSeqDoc = await refSeqModel
        .findById(refSeq)
        .session(session)
        .exec()
      if (!refSeqDoc) {
        throw new Error(
          `RefSeq was not found by assembly "${assembly}" and seq_id "${refSeq}" not found`,
        )
      }

      console.log(`*** COPY FEATURE ON: ${copyFeature}`)
      console.log(`*** ORIGINAL FEATUREID ON: ${originalFeatureId}`)
      // CopyFeature is called from CopyFeature.tsx
      if (copyFeature) {
        const topLevelFeature = await featureModel
          .findOne({ allIds: originalFeatureId })
          .session(session)
          .exec()
        if (!topLevelFeature) {
          throw new Error(`Could not find feature with ID "${parentFeatureId}"`)
        }
        logger.debug?.(
          `*** topLevelFeature: "${JSON.stringify(topLevelFeature)}"`,
        )
        const copiedObject = JSON.parse(JSON.stringify(topLevelFeature))

        copiedObject._id = addedFeature._id as unknown as Types.ObjectId // We need to set new featureId value here
        copiedObject.refSeq = addedFeature.refSeq as unknown as Types.ObjectId // We need to set target assembly refSeq value here

        logger.debug?.(`*** UUSI: "${JSON.stringify(copiedObject)}"`)
        const featureIds: string[] = []
        // Let's add featureId to each child recursively
        const newFeatureLine = this.generateNewIds(copiedObject, featureIds)
        // // Remove "new generated featureId" from "allIds" -array because newFeatureId was already provided. Then add correct newFeatureId into it
        // const index = featureIds.indexOf(newFeatureLine._id, 0)
        // if (index > -1) {
        //   featureIds.splice(index, 1)
        // }
        // featureIds.push(newFeatureId)
        logger.debug?.(`*** UUDET FEATUREID:T: "${JSON.stringify(featureIds)}"`)
        // newFeatureLine.allIds = featureIds // **** TODO : **** HERE WE HAVE TO RE-GENERATE VALUE AGAIN
        // copiedObject.allIds = [addedFeature._id] // **** TODO : **** HERE WE HAVE TO RE-GENERATE VALUE AGAIN

        logger.debug?.(`*** UUSIN: "${JSON.stringify(newFeatureLine)}"`)
        // // Add into Mongo
        const [newFeatureDoc] = await featureModel.create([{...newFeatureLine, allIds: featureIds}], {
          session,
        })
        logger.debug?.(`Added new feature "${JSON.stringify(newFeatureDoc)}"`)
        logger.debug?.(`Added new feature, docId "${newFeatureDoc._id}"`)
        featureCnt++
      } else {
        // Adding new child feature
        if (parentFeatureId) {
          const topLevelFeature = await featureModel
            .findOne({ allIds: parentFeatureId })
            .session(session)
            .exec()
          if (!topLevelFeature) {
            throw new Error(
              `Could not find feature with ID "${parentFeatureId}"`,
            )
          }
          const parentFeature = this.getFeatureFromId(
            topLevelFeature,
            parentFeatureId,
          )
          if (!parentFeature) {
            throw new Error(
              `Could not find feature with ID "${parentFeatureId}" in feature "${topLevelFeature._id}"`,
            )
          }
          if (!parentFeature.children) {
            parentFeature.children = new Map()
          }
          if (!parentFeature.attributes?.id) {
            let { attributes } = parentFeature
            if (!attributes) {
              attributes = {}
            }
            attributes = {
              id: [parentFeature._id.toString()],
              ...JSON.parse(JSON.stringify(attributes)),
            }
            parentFeature.attributes = attributes
          }
          parentFeature.children.set(addedFeature._id, {
            allIds: [],
            ...addedFeature,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            _id: addedFeature._id,
          })
          const childIds = this.getChildFeatureIds(addedFeature)
          topLevelFeature.allIds.push(addedFeature._id, ...childIds)
          topLevelFeature.save()
          logger.debug?.(`Added docId "${topLevelFeature._id}"`)
        } else {
          const childIds = this.getChildFeatureIds(addedFeature)
          const allIds = [addedFeature._id, ...childIds]
          const [newFeatureDoc] = await featureModel.create(
            [{ allIds, ...addedFeature }],
            { session },
          )
          logger.debug?.(`Added docId "${newFeatureDoc._id}"`)
        }
        featureCnt++
      }
    }
    logger.debug?.(`Added ${featureCnt} new feature(s) into database.`)
  }

  async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  async executeOnClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    const { changes, assembly } = this
    for (const change of changes) {
      const { addedFeature, parentFeatureId } = change
      if (parentFeatureId) {
        const parentFeature = dataStore.getFeature(parentFeatureId)
        if (!parentFeature) {
          throw new Error(`Could not find parent feature "${parentFeatureId}"`)
        }
        parentFeature.addChild(addedFeature)
      } else {
        dataStore.addFeature(assembly, addedFeature)
      }
    }
  }

  getInverse() {
    const { changes, changedIds, assembly, logger } = this
    const inverseChangedIds = changedIds.slice().reverse()
    const inverseChanges = changes
      .slice()
      .reverse()
      .map((addFeatureChange) => ({
        deletedFeature: addFeatureChange.addedFeature,
        parentFeatureId: addFeatureChange.parentFeatureId,
      }))

    return new DeleteFeatureChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'DeleteFeatureChange',
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}

export function isAddFeatureChange(
  change: unknown,
): change is AddFeatureChange {
  return (change as AddFeatureChange).typeName === 'AddFeatureChange'
}
