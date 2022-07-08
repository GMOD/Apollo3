import { GFF3Feature } from '@gmod/gff'
import { FeatureDocument } from 'apollo-schemas'
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
    const featuresForChanges: {
      feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs
      topLevelFeature: FeatureDocument
    }[] = []
    // Let's first check that all features are found
    for (const change of changes) {
      // const { featureId, targetAssemblyId: TargetAssemblyId } = change
      // const { featureId, targetAssemblyId } = change
      const { featureId, targetAssemblyId } = change

      // Search correct feature
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

      // const regSeqId = '62c5c9d43109f9acb5d9f663'
      const gff3Feature = topLevelFeature as unknown as GFF3Feature
      const jsonArray = JSON.parse(`[${JSON.stringify(gff3Feature)}]`)

      for (const featureLine of jsonArray) {
        this.logger.debug?.(`One feature line: ${JSON.stringify(featureLine)}`)
        // Let's add featureId to parent feature
        const newFeatureId = uuidv4()
        const featureIds = [newFeatureId]
        featureLine._id = null

        // Let's add featureId to each child recursively
        const newFeatureLine = this.setAndGetFeatureIdRecursively(
          { ...featureLine, newFeatureId },
          featureIds,
        )
        const refSeqDoc = await refSeqModel
          .findOne({ assembly: targetAssemblyId, name: newFeatureLine.seq_id })
          .session(session)
          .exec()
        if (!refSeqDoc) {
          throw new Error(
            `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${newFeatureLine.seq_id}" not found`,
          )
        }
        this.logger.debug?.(`New assemblyId: ${targetAssemblyId}`)
        this.logger.debug?.(`New refSeqId: ${refSeqDoc._id}`)
        this.logger.debug?.(`New featureId: ${newFeatureLine.featureId}`)
        this.logger.debug?.(`New feature: ${JSON.stringify(newFeatureLine)}`)

        // Add into Mongo
        const [newFeatureDoc] = await featureModel.create(
          [
            {
              refSeq: refSeqDoc._id,
              featureIds,
              ...newFeatureLine,
            },
          ],
          { session },
        )
        this.logger.debug?.(`Added docId "${newFeatureDoc._id}"`)
      }

      this.logger.debug?.(`LOPPUU...`)

      // this.logger.debug?.(`NEW FEATURE ID ENTRY=${newFeatureLine}`)

      // // const gff3Feature = topLevelFeature as unknown as GFF3Feature
      // const gff3Feature = newFeatureLine as unknown as GFF3Feature
      // const jsonArray = JSON.parse(`[${JSON.stringify(gff3Feature)}]`)
      // this.logger.debug?.(`ENTRY=${JSON.stringify(jsonArray)}`)

      // this.logger.debug?.(`AssemblyId: "${this.assemblyId}"`)
      // this.logger.debug?.(`TargetAssemblyId: "${targetAssemblyId}"`)
      // this.assemblyId = targetAssemblyId
      // // Add new feature into database
      // const jsonArray = JSON.parse(`[${JSON.stringify(newFeatureLine)}]`)
      // await this.addFeatureIntoDb(jsonArray, backend)
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
