import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from 'apollo-common'
import { AnnotationFeatureSnapshot } from 'apollo-mst'

import { DeleteFeatureChange } from './DeleteFeatureChange'

interface SerializedAddFeatureChangeBase extends SerializedFeatureChange {
  typeName: 'AddFeatureChange'
}

export interface AddFeatureChangeDetails {
  addedFeature: AnnotationFeatureSnapshot
  parentFeatureId?: string // Parent feature to where feature will be added
  copyFeature?: boolean // Are we copying or adding a new child feature
  allIds?: string[]
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
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ addedFeature, allIds, copyFeature, parentFeatureId }] = changes
      return {
        typeName,
        changedIds,
        assembly,
        addedFeature,
        parentFeatureId,
        copyFeature,
        allIds,
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
    const { assemblyModel, featureModel, refSeqModel, session, user } = backend
    const { assembly, changes, logger } = this

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
      const { addedFeature, allIds, copyFeature, parentFeatureId } = change
      const { _id, refSeq } = addedFeature
      const refSeqDoc = await refSeqModel
        .findById(refSeq)
        .session(session)
        .exec()
      if (!refSeqDoc) {
        throw new Error(
          `RefSeq was not found by assembly "${assembly}" and seq_id "${refSeq}" not found`,
        )
      }

      // CopyFeature is called from CopyFeature.tsx
      if (copyFeature) {
        // Add into Mongo
        const [newFeatureDoc] = await featureModel.create(
          [{ ...addedFeature, allIds, status: -1, user }],
          { session },
        )
        logger.debug?.(
          `Copied feature, docId "${newFeatureDoc._id}" to assembly "${assembly}"`,
        )
        featureCnt++
      } else {
        addedFeature.gffId = _id // User added manually new feature so then gffId = _id
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
          if (!parentFeature.attributes?._id) {
            let { attributes } = parentFeature
            if (!attributes) {
              attributes = {}
            }
            attributes = {
              _id: [parentFeature._id.toString()],
              ...JSON.parse(JSON.stringify(attributes)),
            }
            parentFeature.attributes = attributes
          }
          parentFeature.children.set(_id, {
            allIds: [],
            ...addedFeature,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            _id,
          })
          const childIds = this.getChildFeatureIds(addedFeature)
          topLevelFeature.allIds.push(_id, ...childIds)
          await topLevelFeature.save()
        } else {
          const childIds = this.getChildFeatureIds(addedFeature)
          const allIdsV2 = [_id, ...childIds]
          const [newFeatureDoc] = await featureModel.create(
            [{ allIds: allIdsV2, status: 0, ...addedFeature }],
            { session },
          )
          logger.verbose?.(`Added docId "${newFeatureDoc._id}"`)
        }
      }
      featureCnt++
    }
    logger.debug?.(`Added ${featureCnt} new feature(s) into database.`)
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  async executeOnClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    const { assembly, changes } = this
    for (const change of changes) {
      const { addedFeature, parentFeatureId } = change
      if (parentFeatureId) {
        const parentFeature = dataStore.getFeature(parentFeatureId)
        if (!parentFeature) {
          throw new Error(`Could not find parent feature "${parentFeatureId}"`)
        }
        // create an ID for the parent feature if it does not have one
        if (!parentFeature.attributes.get('_id')) {
          parentFeature.setAttribute('_id', [parentFeature._id])
        }
        parentFeature.addChild(addedFeature)
      } else {
        dataStore.addFeature(assembly, addedFeature)
      }
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((addFeatureChange) => ({
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
