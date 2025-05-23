/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  type ChangeOptions,
  type ClientDataStore,
  FeatureChange,
  type LocalGFF3DataStore,
  type SerializedFeatureChange,
  type ServerDataStore,
} from '@apollo-annotation/common'
import { type Feature, type FeatureDocument } from '@apollo-annotation/schemas'

interface SerializedStrandChangeBase extends SerializedFeatureChange {
  typeName: 'StrandChange'
}

interface StrandChangeDetails {
  featureId: string
  oldStrand: -1 | 1 | undefined
  newStrand: -1 | 1 | undefined
}

interface SerializedStrandChangeSingle
  extends SerializedStrandChangeBase,
    StrandChangeDetails {}

interface SerializedStrandChangeMultiple extends SerializedStrandChangeBase {
  changes: StrandChangeDetails[]
}

type SerializedStrandChange =
  | SerializedStrandChangeSingle
  | SerializedStrandChangeMultiple

export class StrandChange extends FeatureChange {
  typeName = 'StrandChange' as const
  changes: StrandChangeDetails[]

  constructor(json: SerializedStrandChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedStrandChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ featureId, newStrand, oldStrand }] = changes
      return { typeName, changedIds, assembly, featureId, oldStrand, newStrand }
    }
    return { typeName, changedIds, assembly, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this
    const featuresForChanges: {
      feature: Feature
      topLevelFeature: FeatureDocument
    }[] = []
    // Let's first check that all features are found and those old values match with expected ones. We do this just to be sure that all changes can be done.
    for (const entry of changes) {
      const { featureId, oldStrand } = entry

      // Search correct feature
      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        logger.error(errMsg)
        throw new Error(errMsg)
        // throw new NotFoundException(errMsg)  -- This is causing runtime error because Exception comes from @nestjs/common!!!
      }
      logger.debug?.(`*** Feature found: ${JSON.stringify(topLevelFeature)}`)

      const foundFeature = this.getFeatureFromId(topLevelFeature, featureId)
      if (!foundFeature) {
        const errMsg = 'ERROR when searching feature by featureId'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      logger.debug?.(`*** Found feature: ${JSON.stringify(foundFeature)}`)
      if (foundFeature.strand !== oldStrand) {
        const errMsg = `*** ERROR: Feature's current strand "${topLevelFeature.strand}" doesn't match with expected value "${oldStrand}"`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      featuresForChanges.push({ feature: foundFeature, topLevelFeature })
    }

    // Let's update objects.
    for (const [idx, change] of changes.entries()) {
      const { newStrand } = change
      const { feature, topLevelFeature } = featuresForChanges[idx]
      feature.strand = newStrand
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('strand') // Mark as modified. Without this save() -method is not updating data in database
      } else {
        topLevelFeature.markModified('children') // Mark as modified. Without this save() -method is not updating data in database
      }

      try {
        await topLevelFeature.save()
      } catch (error) {
        logger.debug?.(`*** FAILED: ${error}`)
        throw error
      }
      logger.debug?.(
        `*** Object updated in Mongo. New object: ${JSON.stringify(
          topLevelFeature,
        )}`,
      )
    }
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  async executeOnClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    for (const [idx, changedId] of this.changedIds.entries()) {
      const feature = dataStore.getFeature(changedId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      feature.setStrand(this.changes[idx].newStrand)
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger, typeName } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((endChange) => ({
      featureId: endChange.featureId,
      oldStrand: endChange.newStrand,
      newStrand: endChange.oldStrand,
    }))
    return new StrandChange(
      {
        changedIds: inverseChangedIds,
        typeName,
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}
