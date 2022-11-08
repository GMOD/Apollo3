import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  ServerDataStore,
} from './abstract/Change'
import {
  FeatureChange,
  SerializedFeatureChange,
} from './abstract/FeatureChange'
import { DeleteFeatureChange } from './DeleteFeatureChange'

interface SerializedCopyFeatureChangeBase extends SerializedFeatureChange {
  typeName: 'CopyFeatureChange'
}

export interface CopyFeatureChangeDetails {
  featureId: string
  newFeatureId: string
  targetAssemblyId: string
}

interface SerializedCopyFeatureChangeSingle
  extends SerializedCopyFeatureChangeBase,
    CopyFeatureChangeDetails {}

interface SerializedCopyFeatureChangeMultiple
  extends SerializedCopyFeatureChangeBase {
  changes: CopyFeatureChangeDetails[]
}

type SerializedCopyFeatureChange =
  | SerializedCopyFeatureChangeSingle
  | SerializedCopyFeatureChangeMultiple

export class CopyFeatureChange extends FeatureChange {
  typeName = 'CopyFeatureChange' as const
  changes: CopyFeatureChangeDetails[]

  constructor(json: SerializedCopyFeatureChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedCopyFeatureChange {
    const { changes, changedIds, typeName, assembly } = this
    if (changes.length === 1) {
      const [{ featureId, targetAssemblyId, newFeatureId }] = changes
      return {
        typeName,
        changedIds,
        assembly,
        featureId,
        newFeatureId,
        targetAssemblyId,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { featureModel, session, refSeqModel } = backend
    const { changes, assembly, logger } = this

    // Loop the changes
    for (const change of changes) {
      const { featureId, targetAssemblyId, newFeatureId } = change

      // Search feature
      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      // logger.debug?.(
      //   `*** Feature found: ${JSON.stringify(topLevelFeature)}`,
      // )

      const newFeature = this.getFeatureFromId(topLevelFeature, featureId)
      if (!newFeature) {
        throw new Error(
          `Feature ID "${featureId}" not found in parent feature "${topLevelFeature._id}"`,
        )
      }

      const featureIds: string[] = []

      const refSeqDoc = await refSeqModel
        .findById(newFeature.refSeq)
        .session(session)
        .exec()
      if (!refSeqDoc) {
        throw new Error(
          `RefSeq was not found by assembly "${assembly}" and seq_id "${topLevelFeature.refSeq}" not found`,
        )
      }

      // Let's add featureId to each child recursively
      const newFeatureLine = this.generateNewIds(newFeature, featureIds)
      logger.verbose?.(`New featureIds: ${featureIds}`)
      logger.verbose?.(`New assembly: ${targetAssemblyId}`)
      logger.verbose?.(`New refSeqId: ${refSeqDoc._id}`)
      logger.verbose?.(`New featureId: ${newFeatureLine._id}`)

      // Add into Mongo
      const [newFeatureDoc] = await featureModel.create(
        [
          {
            ...newFeatureLine,
            _id: newFeatureId,
            refSeq: refSeqDoc._id,
            allIds: featureIds,
          },
        ],
        { session },
      )
      logger.debug?.(`Added new feature, docId "${newFeatureDoc._id}"`)
    }
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  async applyToClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    this.changes.forEach((change) => {
      const { featureId } = change
      const feature = dataStore.getFeature(featureId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${featureId}"`)
      }
    })
  }

  getInverse() {
    const { changes, changedIds, assembly, logger } = this
    const inverseChangedIds = changedIds.slice().reverse()
    const inverseChanges = changes
      .slice()
      .reverse()
      .map((endChange) => ({
        featureId: endChange.featureId,
        assembly: endChange.targetAssemblyId,
        parentFeatureId: '',
      }))
    return new DeleteFeatureChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'DeleteFeatureChange',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}

export function isCopyFeatureChange(
  change: unknown,
): change is CopyFeatureChange {
  return (change as CopyFeatureChange).typeName === 'CopyFeatureChange'
}
