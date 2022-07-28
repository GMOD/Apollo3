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

interface SerializedCopyFeatureChangeBase extends SerializedChange {
  typeName: 'CopyFeatureChange'
}

export interface CopyFeatureChangeDetails {
  featureId: string
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
    if (this.changes.length === 1) {
      const [{ featureId, targetAssemblyId }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        featureId,
        targetAssemblyId,
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
      const { featureId, targetAssemblyId } = change

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
      // this.logger.debug?.(
      //   `*** Feature found: ${JSON.stringify(topLevelFeature)}`,
      // )

      const topLevelFeatureObject =
        topLevelFeature.toObject() as GFF3FeatureLineWithFeatureIdAndOptionalRefs
      const newFeature = this.getObjectByFeatureId(
        topLevelFeatureObject,
        featureId,
      )
      if (!newFeature) {
        throw new Error(
          `Feature ID "${featureId}" not found in parent feature "${topLevelFeature.featureId}"`,
        )
      }

      const newFeatureId = uuidv4() // Set new featureId in target assembly
      const featureIds = [newFeatureId]
      newFeature.featureId = newFeatureId // Set new featureId in top level

      const refSeqDoc = await refSeqModel
        .findOne({ assembly: targetAssemblyId, name: newFeature.seq_id })
        .session(session)
        .exec()
      if (!refSeqDoc) {
        throw new Error(
          `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${topLevelFeature.seq_id}" not found`,
        )
      }

      // Let's add featureId to each child recursively
      const newFeatureLine = this.setAndGetFeatureIdRecursively(
        newFeature,
        featureIds,
      )
      this.logger.verbose?.(`New featureIds: ${featureIds}`)
      this.logger.verbose?.(`New assemblyId: ${targetAssemblyId}`)
      this.logger.verbose?.(`New refSeqId: ${refSeqDoc._id}`)
      this.logger.verbose?.(`New featureId: ${newFeatureLine.featureId}`)

      // Add into Mongo
      const [newFeatureDoc] = await featureModel.create(
        [
          {
            ...newFeatureLine,
            _id: generateObjectId(),
            refSeq: refSeqDoc._id,
            featureIds,
          },
        ],
        { session },
      )
      this.logger.debug?.(`Added new feature, docId "${newFeatureDoc._id}"`)
    }
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
        targetAssemblyId: endChange.targetAssemblyId,
      }))
    return new CopyFeatureChange(
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

export function isCopyFeatureChange(
  change: unknown,
): change is CopyFeatureChange {
  return (change as CopyFeatureChange).typeName === 'CopyFeatureChange'
}
