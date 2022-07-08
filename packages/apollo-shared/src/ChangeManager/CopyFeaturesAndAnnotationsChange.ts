import { GFF3Feature, GFF3FeatureLineWithRefs } from '@gmod/gff'
import { FeatureDocument } from 'apollo-schemas'
import { ObjectID } from 'bson'
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

interface SerializedCopyFeaturesAndAnnotationsChangeBase
  extends SerializedChange {
  typeName: 'CopyFeaturesAndAnnotationsChange'
}

export interface CopyFeaturesAndAnnotationsChangeDetails {
  featureId: string
  targetAssemblyId: string
}

interface SerializedCopyFeaturesAndAnnotationsChangeSingle
  extends SerializedCopyFeaturesAndAnnotationsChangeBase,
    CopyFeaturesAndAnnotationsChangeDetails {}

interface SerializedCopyFeaturesAndAnnotationsChangeMultiple
  extends SerializedCopyFeaturesAndAnnotationsChangeBase {
  changes: CopyFeaturesAndAnnotationsChangeDetails[]
}

type SerializedCopyFeaturesAndAnnotationsChange =
  | SerializedCopyFeaturesAndAnnotationsChangeSingle
  | SerializedCopyFeaturesAndAnnotationsChangeMultiple

export class CopyFeaturesAndAnnotationsChange extends FeatureChange {
  typeName = 'CopyFeaturesAndAnnotationsChange' as const
  changes: CopyFeaturesAndAnnotationsChangeDetails[]

  constructor(
    json: SerializedCopyFeaturesAndAnnotationsChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedCopyFeaturesAndAnnotationsChange {
    if (this.changes.length === 1) {
      const [{ featureId, targetAssemblyId: TargetAssemblyId }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        featureId,
        targetAssemblyId: TargetAssemblyId,
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
    // const featuresForChanges: {
    //   feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs
    //   topLevelFeature: FeatureDocument
    // }[] = []
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
      this.logger.debug?.(
        `*** Feature found: ${JSON.stringify(topLevelFeature)}`,
      )

      const jsonArray2 = JSON.parse(`[${JSON.stringify(topLevelFeature)}]`)
      // const refSeqName = topLevelFeature.seq_id

      for (const featureLine of jsonArray2) {
        const newFeatureId = uuidv4() // Set new featureId in target assembly
        const featureIds = [newFeatureId]
        featureLine._id = new ObjectID() // Set new doc id
        featureLine.featureId = newFeatureId // Set new featureId in top level

        const refSeqDoc = await refSeqModel
          .findOne({ assembly: targetAssemblyId, name: featureLine.seq_id })
          .session(session)
          .exec()
        if (!refSeqDoc) {
          throw new Error(
            `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${featureLine.seq_id}" not found`,
          )
        }
        featureLine.refSeq = refSeqDoc._id // Set new reference seq id from target assembly

        // Let's add featureId to each child recursively
        const newFeatureLine = this.setAndGetFeatureIdRecursively(
          { ...featureLine, newFeatureId },
          featureIds,
        )
        this.logger.debug?.(`New assemblyId: ${targetAssemblyId}`)
        this.logger.debug?.(`New refSeqId: ${refSeqDoc._id}`)
        this.logger.debug?.(`New featureId: ${newFeatureLine.featureId}`)
        this.logger.debug?.(`New feature: ${JSON.stringify(newFeatureLine)}`)

        // Add into Mongo
        const [newFeatureDoc] = await featureModel.create(
          [
            {
              featureIds,
              ...newFeatureLine,
            },
          ],
          { session },
        )
        this.logger.debug?.(`Added docId "${newFeatureDoc._id}"`)
      }
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
      // feature.setEnd(this.changes[idx].TargetAssemblyId)
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
        // newEnd: endChange.TargetAssemblyId,
      }))
    return new CopyFeaturesAndAnnotationsChange(
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

export function isCopyFeaturesAndAnnotationsChange(
  change: unknown,
): change is CopyFeaturesAndAnnotationsChange {
  return (
    (change as CopyFeaturesAndAnnotationsChange).typeName ===
    'CopyFeaturesAndAnnotationsChange'
  )
}
