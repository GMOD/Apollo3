import { AnnotationFeatureSnapshot } from 'apollo-mst'

import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import { FeatureChange } from './FeatureChange'
import { DeleteFeatureChange } from '..'

interface SerializedAddFeatureChangeBase extends SerializedChange {
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
    const { changes, changedIds, typeName, assemblyId } = this
    if (changes.length === 1) {
      const [{ addedFeature, parentFeatureId }] = changes
      return { typeName, changedIds, assemblyId, addedFeature, parentFeatureId }
    }
    return { typeName, changedIds, assemblyId, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { assemblyModel, featureModel, refSeqModel, session } = backend
    const { changes, assemblyId, logger } = this

    const assembly = await assemblyModel
      .findById(assemblyId)
      .session(session)
      .exec()
    if (!assembly) {
      const errMsg = `*** ERROR: Assembly with id "${assemblyId}" not found`
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
          `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${refSeq}" not found`,
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
        logger.log({ topLevelFeature })
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

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  async applyToClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    for (const change of this.changes) {
      const { addedFeature, parentFeatureId } = change
      if (parentFeatureId) {
        const parentFeature = dataStore.getFeature(parentFeatureId)
        if (!parentFeature) {
          throw new Error(`Could not find parent feature "${parentFeatureId}"`)
        }
        parentFeature.addChild(addedFeature)
      } else {
        dataStore.addFeature(this.assemblyId, addedFeature)
      }
    }
  }

  getInverse() {
    const { changes, changedIds, assemblyId, logger } = this
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
        assemblyId,
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
