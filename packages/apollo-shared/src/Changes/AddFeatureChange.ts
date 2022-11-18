import { AnnotationFeatureSnapshot } from 'apollo-mst'

import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from './abstract'
import { DeleteFeatureChange } from './DeleteFeatureChange'

interface SerializedAddFeatureChangeBase extends SerializedFeatureChange {
  typeName: 'AddFeatureChange'
}

export interface AddFeatureChangeDetails {
  addedFeature: AnnotationFeatureSnapshot
  parentFeatureId?: string // Parent feature to where feature will be added
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
      const [{ addedFeature, parentFeatureId }] = changes
      return { typeName, changedIds, assembly, addedFeature, parentFeatureId }
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
      const { addedFeature, parentFeatureId } = change
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
      if (parentFeatureId) {
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
      } else {
        const childIds = this.getChildFeatureIds(addedFeature)
        const allIds = [addedFeature._id, ...childIds]
        const [newFeatureDoc] = await featureModel.create(
          [{ allIds, ...addedFeature }],
          { session },
        )
        logger.verbose?.(`Added docId "${newFeatureDoc._id}"`)
      }
      featureCnt++
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
