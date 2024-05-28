/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from 'apollo-common'
import { Feature, FeatureDocument } from 'apollo-schemas'

interface SerializedFeatureAttributeChangeBase extends SerializedFeatureChange {
  typeName: 'FeatureAttributeChange'
}

export interface FeatureAttributeChangeDetails {
  featureId: string
  attributes: Record<string, string[]>
}

interface SerializedFeatureAttributeChangeSingle
  extends SerializedFeatureAttributeChangeBase,
    FeatureAttributeChangeDetails {}

interface SerializedFeatureAttributeChangeMultiple
  extends SerializedFeatureAttributeChangeBase {
  changes: FeatureAttributeChangeDetails[]
}

type SerializedFeatureAttributeChange =
  | SerializedFeatureAttributeChangeSingle
  | SerializedFeatureAttributeChangeMultiple

export class FeatureAttributeChange extends FeatureChange {
  typeName = 'FeatureAttributeChange' as const
  changes: FeatureAttributeChangeDetails[]

  constructor(json: SerializedFeatureAttributeChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedFeatureAttributeChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ attributes, featureId }] = changes
      return { typeName, changedIds, assembly, featureId, attributes }
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
    // Loop the changes and check that all features are found
    for (const change of changes) {
      const { featureId } = change

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
      featuresForChanges.push({ feature: foundFeature, topLevelFeature })
    }

    // Let's update objects
    for (const [idx, change] of changes.entries()) {
      const { attributes } = change
      const { feature, topLevelFeature } = featuresForChanges[idx]
      feature.attributes = attributes
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('attributes') // Mark as modified. Without this save() -method is not updating data in database
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
        `*** Feature attributes modified (added, edited or deleted), docId: ${JSON.stringify(
          topLevelFeature,
        )}`,
      )
    }
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
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
      feature.setAttributes(
        new Map(Object.entries(this.changes[idx].attributes)),
      )
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((oneChange) => ({
      featureId: oneChange.featureId,
      attributes: oneChange.attributes,
    }))
    return new FeatureAttributeChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'FeatureAttributeChange',
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}

export function isFeatureAttributeChange(
  change: unknown,
): change is FeatureAttributeChange {
  return (
    (change as FeatureAttributeChange).typeName === 'FeatureAttributeChange'
  )
}
