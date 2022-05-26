import { GFF3Feature, GFF3FeatureLine } from '@gmod/gff'
import { v4 as uuidv4 } from 'uuid'

import {
  Change,
  ChangeOptions,
  SerializedChange,
  ServerDataStore,
} from './Change'

interface GFF3FeatureLineWithOptionalRefs extends GFF3FeatureLine {
  // eslint-disable-next-line camelcase
  child_features?: GFF3Feature[]
  // eslint-disable-next-line camelcase
  derived_features?: GFF3Feature[]
}

export interface GFF3FeatureLineWithFeatureIdAndOptionalRefs
  extends GFF3FeatureLineWithOptionalRefs {
  featureId: string
}

export abstract class FeatureChange extends Change {
  logger: import('@nestjs/common').LoggerService
  abstract typeName: string

  static assemblyId: string

  constructor(json: SerializedChange, options?: ChangeOptions) {
    super(json, options)
    const { assemblyId } = json
    this.assemblyId = assemblyId
    this.logger = options?.logger || console
  }

  /**
   * Get single feature by featureId
   * @param featureObject -
   * @param featureId -
   * @returns
   */
  getObjectByFeatureId(
    feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
    featureId: string,
  ): GFF3FeatureLineWithFeatureIdAndOptionalRefs | null {
    this.logger.debug?.(`Entry=${JSON.stringify(feature)}`)

    this.logger.debug?.(`Top level featureId=${feature.featureId}`)
    if (feature.featureId === featureId) {
      this.logger.debug?.(
        `Top level featureId matches in object ${JSON.stringify(feature)}`,
      )
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    this.logger.debug?.(
      `FeatureId was not found on top level so lets make recursive call...`,
    )
    for (const childFeature of feature.child_features || []) {
      for (const childFeatureLine of childFeature) {
        const subFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs | null =
          this.getObjectByFeatureId(
            childFeatureLine as GFF3FeatureLineWithFeatureIdAndOptionalRefs,
            featureId,
          )
        if (subFeature) {
          return subFeature
        }
      }
    }
    return null
  }

  async addFeatureIntoDb(gff3Feature: GFF3Feature, backend: ServerDataStore) {
    const { featureModel, refSeqModel, session } = backend
    const { assemblyId } = this

    for (const featureLine of gff3Feature) {
      const refName = featureLine.seq_id
      if (!refName) {
        throw new Error(
          `Valid seq_id not found in feature ${JSON.stringify(featureLine)}`,
        )
      }
      const refSeqDoc = await refSeqModel
        .findOne({ assembly: assemblyId, name: refName })
        .session(session)
        .exec()
      if (!refSeqDoc) {
        throw new Error(
          `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${refName}" not found, this.assembly "${this.assemblyId}", type "${backend.typeName}"`,
        )
      }
      // Let's add featureId to parent feature
      const featureId = uuidv4()
      const featureIds = [featureId]
      this.logger.verbose?.(
        `Adding new FeatureId: value=${JSON.stringify(featureLine)}`,
      )

      // Let's add featureId to each child recursively
      this.setAndGetFeatureIdRecursively(
        { ...featureLine, featureId },
        featureIds,
      )
      this.logger.verbose?.(`So far apollo ids are: ${featureIds.toString()}\n`)

      // Add into Mongo
      const [newFeatureDoc] = await featureModel.create(
        [
          {
            refSeq: refSeqDoc._id,
            featureId,
            featureIds,
            ...featureLine,
          },
        ],
        { session },
      )
      this.logger.verbose?.(`Added docId "${newFeatureDoc._id}"`)
    }
  }

  /**
   * Loop child features in parent feature and add featureId to each child's attribute
   * @param parentFeature - Parent feature
   */
  setAndGetFeatureIdRecursively(
    parentFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
    featureIdArrAsParam: string[],
  ): string[] {
    if (parentFeature.child_features?.length === 0) {
      delete parentFeature.child_features
    }
    if (parentFeature.derived_features?.length === 0) {
      delete parentFeature.derived_features
    }
    // If there are child features
    if (parentFeature.child_features) {
      parentFeature.child_features = parentFeature.child_features.map(
        (childFeature) =>
          childFeature.map((childFeatureLine) => {
            const featureId = uuidv4()
            featureIdArrAsParam.push(featureId)
            const newChildFeature = { ...childFeatureLine, featureId }
            this.setAndGetFeatureIdRecursively(
              newChildFeature,
              featureIdArrAsParam,
            )
            return newChildFeature
          }),
      )
    }
    return featureIdArrAsParam
  }
}
