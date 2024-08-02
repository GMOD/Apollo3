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
} from '@apollo-annotation/common'
import { Feature, FeatureDocument } from '@apollo-annotation/schemas'

interface SerializedLocationEndChangeBase extends SerializedFeatureChange {
  typeName: 'LocationEndChange'
}

export interface LocationEndChangeDetails {
  featureId: string
  oldEnd: number
  newEnd: number
}

interface SerializedLocationEndChangeSingle
  extends SerializedLocationEndChangeBase,
    LocationEndChangeDetails {}

interface SerializedLocationEndChangeMultiple
  extends SerializedLocationEndChangeBase {
  changes: LocationEndChangeDetails[]
}

type SerializedLocationEndChange =
  | SerializedLocationEndChangeSingle
  | SerializedLocationEndChangeMultiple

export class LocationEndChange extends FeatureChange {
  typeName = 'LocationEndChange' as const
  changes: LocationEndChangeDetails[]

  constructor(json: SerializedLocationEndChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedLocationEndChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ featureId, newEnd, oldEnd }] = changes
      return { typeName, changedIds, assembly, featureId, oldEnd, newEnd }
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
    for (const change of changes) {
      const { featureId, oldEnd } = change

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
      logger.debug?.(
        `*** TOP level feature found: ${JSON.stringify(topLevelFeature)}`,
      )

      const foundFeature = this.getFeatureFromId(topLevelFeature, featureId)
      if (!foundFeature) {
        const errMsg = 'ERROR when searching feature by featureId'
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      logger.debug?.(`*** Found feature: ${JSON.stringify(foundFeature)}`)
      if (foundFeature.max === oldEnd) {
        featuresForChanges.push({ feature: foundFeature, topLevelFeature })
      } else {
        if (foundFeature.children) {
          for (const [, childFeature] of foundFeature.children) {
            if (childFeature.max === oldEnd) {
              logger.debug?.(
                `*************** UPDATE CHILD FEATURE ID= ${featureId}, CHILD: ${JSON.stringify(
                  childFeature,
                )}`,
              )
              featuresForChanges.push({
                feature: childFeature,
                topLevelFeature,
              })
              break
            }
          }
        }
      }
    }

    // Let's update objects.
    for (const [idx, change] of changes.entries()) {
      const { newEnd } = change
      const { feature, topLevelFeature } = featuresForChanges[idx]
      feature.max = newEnd
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('end') // Mark as modified. Without this save() -method is not updating data in database
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
      feature.setMax(this.changes[idx].newEnd)
    }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger, typeName } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((endChange) => ({
      featureId: endChange.featureId,
      oldEnd: endChange.newEnd,
      newEnd: endChange.oldEnd,
    }))
    return new LocationEndChange(
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

export function isLocationEndChange(
  change: unknown,
): change is LocationEndChange {
  return (change as LocationEndChange).typeName === 'LocationEndChange'
}
