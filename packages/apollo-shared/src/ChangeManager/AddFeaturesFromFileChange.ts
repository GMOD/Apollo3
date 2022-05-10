import gff, { GFF3Feature, GFF3Item } from '@gmod/gff'
import { FeatureDocument } from 'apollo-schemas'
import { resolveIdentifier } from 'mobx-state-tree'

import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
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

interface FeaturesFromFileChange {
  fileChecksum: string
}

interface SerializedAddFeaturesFromFileChange extends SerializedChange {
  typeName: 'AddFeaturesFromFileChange'
  changes: FeaturesFromFileChange[]
}

export class AddFeaturesFromFileChange extends FeatureChange {
  typeName = 'AddFeaturesFromFileChange' as const
  changes: FeaturesFromFileChange[]

  constructor(
    json: SerializedAddFeaturesFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changedIds = json.changedIds
    this.changes = json.changes
  }

  toJSON() {
    return {
      changedIds: this.changedIds,
      typeName: this.typeName,
      changes: this.changes,
      assemblyId: this.assemblyId,
    }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes } = this
    const featuresForChanges: {
      feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs
      topLevelFeature: FeatureDocument
    }[] = []

    // // Let's first check that all features are found and those old values match with expected ones. We do this just to be sure that all changes can be done.
    for (const change of changes) {
      const { fileChecksum } = change
      this.logger.debug?.(`*** File checksum: ${fileChecksum}`)
    }
    // // Let's first check that all features are found and those old values match with expected ones. We do this just to be sure that all changes can be done.
    // for (const change of changes) {
    //   const { featureId, oldEnd } = change

    //   // Search correct feature
    //   const topLevelFeature = await featureModel
    //     .findOne({ featureIds: featureId })
    //     .session(session)
    //     .exec()

    //   if (!topLevelFeature) {
    //     const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
    //     this.logger.error(errMsg)
    //     throw new Error(errMsg)
    //     // throw new NotFoundException(errMsg)  -- This is causing runtime error because Exception comes from @nestjs/common!!!
    //   }
    //   this.logger.debug?.(
    //     `*** Feature found: ${JSON.stringify(topLevelFeature)}`,
    //   )

    //   const foundFeature = this.getObjectByFeatureId(topLevelFeature, featureId)
    //   if (!foundFeature) {
    //     const errMsg = `ERROR when searching feature by featureId`
    //     this.logger.error(errMsg)
    //     throw new Error(errMsg)
    //   }
    //   this.logger.debug?.(`*** Found feature: ${JSON.stringify(foundFeature)}`)
    //   if (foundFeature.end !== oldEnd) {
    //     const errMsg = `*** ERROR: Feature's current end value ${topLevelFeature.end} doesn't match with expected value ${oldEnd}`
    //     this.logger.error(errMsg)
    //     throw new Error(errMsg)
    //   }
    //   featuresForChanges.push({
    //     feature: foundFeature,
    //     topLevelFeature,
    //   })
    // }

    // // Let's update objects.
    // for (const [idx, change] of changes.entries()) {
    //   const { newEnd } = change
    //   const { feature, topLevelFeature } = featuresForChanges[idx]
    //   feature.end = newEnd
    //   if (topLevelFeature.featureId === feature.featureId) {
    //     topLevelFeature.markModified('end') // Mark as modified. Without this save() -method is not updating data in database
    //   } else {
    //     topLevelFeature.markModified('child_features') // Mark as modified. Without this save() -method is not updating data in database
    //   }

    //   try {
    //     await topLevelFeature.save()
    //   } catch (error) {
    //     this.logger.debug?.(`*** FAILED: ${error}`)
    //     throw error
    //   }
    //   this.logger.debug?.(
    //     `*** Object updated in Mongo. New object: ${JSON.stringify(
    //       topLevelFeature,
    //     )}`,
    //   )
    // }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToLocalGFF3(backend: LocalGFF3DataStore) {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    return new AddFeaturesFromFileChange(
      {
        changedIds: this.changedIds,
        typeName: 'AddFeaturesFromFileChange',
        changes: this.changes,
        assemblyId: this.assemblyId,
      },
      { logger: this.logger },
    )
  }
}
