/* eslint-disable @typescript-eslint/require-await */
import {
  type ChangeOptions,
  type ClientDataStore,
  FeatureChange,
  type LocalGFF3DataStore,
  type SerializedFeatureChange,
  type ServerDataStore,
} from '@apollo-annotation/common'
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import type { Feature, FeatureDocument } from '@apollo-annotation/schemas'

import soSequenceTypes from '../Validations/soSequenceTypes.js'

interface SerializedReplaceFeatureChangeBase extends SerializedFeatureChange {
  typeName: 'ReplaceFeatureChange'
}

export interface ReplaceFeatureChangeDetails {
  oldFeature?: AnnotationFeatureSnapshot
  updatedFeature: AnnotationFeatureSnapshot
}

interface SerializedReplaceFeatureChangeSingle
  extends SerializedReplaceFeatureChangeBase,
    ReplaceFeatureChangeDetails {}

interface SerializedReplaceFeatureChangeMultiple
  extends SerializedReplaceFeatureChangeBase {
  changes: ReplaceFeatureChangeDetails[]
}

export type SerializedReplaceFeatureChange =
  | SerializedReplaceFeatureChangeSingle
  | SerializedReplaceFeatureChangeMultiple

export class ReplaceFeatureChange extends FeatureChange {
  typeName = 'ReplaceFeatureChange' as const
  changes: ReplaceFeatureChangeDetails[]

  constructor(json: SerializedReplaceFeatureChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
    this.changedIds = this.changes.map((change) => change.updatedFeature._id)
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification() {
    return 'Feature replaced successfully'
  }

  toJSON(): SerializedReplaceFeatureChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ oldFeature, updatedFeature }] = changes
      return {
        typeName,
        changedIds,
        assembly,
        oldFeature,
        updatedFeature,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this

    const { INDEXED_IDS } = process.env
    const idsToIndex = INDEXED_IDS ? INDEXED_IDS.split(',') : undefined

    for (const [, change] of changes.entries()) {
      const targetFeatureId = change.updatedFeature._id
      const existingFeature = await featureModel
        .findOne({ allIds: targetFeatureId })
        .session(session)
        .exec()

      if (!existingFeature) {
        throw new Error(
          `Could not find feature "${targetFeatureId}" to replace`,
        )
      }
      if (!existingFeature._id.equals(targetFeatureId)) {
        throw new Error(
          `Updated feature's _id "${change.updatedFeature._id}" does not match the db feature id "${targetFeatureId}"`,
        )
      }
      if (!soSequenceTypes.includes(change.updatedFeature.type)) {
        throw new Error(
          `"${change.updatedFeature.type}" is not a valid SO sequence_feature term`,
        )
      }
      if (existingFeature.type !== change.updatedFeature.type) {
        throw new Error(
          `Feature type mismatch. Existing feature is "${existingFeature.type}" but replacement is "${change.updatedFeature.type}"`,
        )
      }

      change.oldFeature = featureToSnapshot(existingFeature)
      const { updatedFeature } = change
      const refSeq = existingFeature.refSeq.toString()

      existingFeature.type = updatedFeature.type
      existingFeature.min = updatedFeature.min
      existingFeature.max = updatedFeature.max
      existingFeature.strand = updatedFeature.strand

      existingFeature.attributes = updatedFeature.attributes
        ? Object.fromEntries(
            Object.entries(updatedFeature.attributes).map(([key, value]) => [
              key,
              value ? [...value] : [],
            ]),
          )
        : undefined
      existingFeature.children = snapshotChildrenToMap(
        updatedFeature.children,
        refSeq,
      )

      existingFeature.allIds = [
        updatedFeature._id,
        ...this.getChildFeatureIds(updatedFeature),
      ]
      const indexedIds = this.getIndexedIds(updatedFeature, idsToIndex)
      existingFeature.indexedIds =
        indexedIds.length > 0 ? indexedIds : undefined

      existingFeature.markModified('attributes')
      existingFeature.markModified('children')
      existingFeature.markModified('allIds')
      existingFeature.markModified('indexedIds')
      await existingFeature.save()

      logger.debug?.(`Replaced top-level feature "${existingFeature.id}"`)
    }
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  async executeOnClient(_dataStore: ClientDataStore) {
    throw new Error('executeOnClient not implemented')
  }

  getInverse(): never {
    throw new Error('getInverse not implemented')
  }
}

function featureToSnapshot(
  featureDoc: FeatureDocument | Feature,
): AnnotationFeatureSnapshot {
  const rawFeature = (
    'toObject' in featureDoc
      ? featureDoc.toObject({ flattenMaps: true })
      : featureDoc
  ) as {
    refSeq: Feature['refSeq']
    type: string
    min: number
    max: number
    strand?: 1 | -1
    attributes?: Record<string, string[]>
    children?: Feature['children']
  }

  return {
    _id: featureDoc._id.toString(),
    refSeq: rawFeature.refSeq.toString(),
    type: rawFeature.type,
    min: rawFeature.min,
    max: rawFeature.max,
    strand: rawFeature.strand,
    attributes: rawFeature.attributes,
    children: rawFeature.children
      ? Object.fromEntries(
          getChildFeatures(rawFeature.children).map((child) => [
            child._id.toString(),
            featureToSnapshot(child),
          ]),
        )
      : undefined,
  }
}

function getChildFeatures(
  children: NonNullable<Feature['children']> | Record<string, Feature>,
) {
  return children instanceof Map
    ? [...children.values()]
    : Object.values(children)
}

function snapshotChildrenToMap(
  children?: Record<string, AnnotationFeatureSnapshot>,
  refSeq?: string,
): FeatureDocument['children'] {
  if (!children) {
    return undefined
  }

  return new Map(
    Object.values(children)
      .map(
        (child) => [child._id, snapshotToNestedFeature(child, refSeq)] as const,
      )
      .sort((a, b) => a[1].min - b[1].min),
  )
}

function snapshotToNestedFeature(
  feature: AnnotationFeatureSnapshot,
  refSeq?: string,
): Feature {
  return {
    allIds: [],
    ...feature,
    _id: feature._id as unknown as Feature['_id'],
    refSeq: refSeq as unknown as Feature['refSeq'],
    attributes: feature.attributes
      ? Object.fromEntries(
          Object.entries(feature.attributes).map(([key, value]) => [
            key,
            value ? [...value] : [],
          ]),
        )
      : undefined,
    children: snapshotChildrenToMap(feature.children, refSeq),
  } as unknown as Feature
}
