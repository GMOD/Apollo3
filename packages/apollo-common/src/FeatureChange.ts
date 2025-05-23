/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { type Feature } from '@apollo-annotation/schemas'
import ObjectID from 'bson-objectid'
import { type Types } from 'mongoose'

import {
  AssemblySpecificChange,
  type SerializedAssemblySpecificChange,
  isAssemblySpecificChange,
} from './AssemblySpecificChange'
import { type ChangeOptions } from './Change'

export interface SerializedFeatureChange
  extends SerializedAssemblySpecificChange {
  /** The IDs of features that were changed in this operation */
  changedIds: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isFeatureChange(thing: any): thing is FeatureChange {
  return (
    isAssemblySpecificChange(thing) &&
    (thing as FeatureChange).changedIds !== undefined
  )
}

export abstract class FeatureChange extends AssemblySpecificChange {
  changedIds: string[]

  constructor(json: SerializedFeatureChange, options?: ChangeOptions) {
    super(json, options)
    this.changedIds = json.changedIds
  }

  /**
   * Get single feature by featureId
   * @param feature -
   * @param featureId -
   * @returns
   */
  getFeatureFromId(feature: Feature, featureId: string): Feature | null {
    const { logger } = this
    logger.verbose?.(`Entry=${JSON.stringify(feature)}`)

    if (feature._id.equals(featureId)) {
      logger.debug?.(
        `Top level featureId matches in the object ${JSON.stringify(feature)}`,
      )
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    logger.debug?.(
      'FeatureId was not found on top level so lets make recursive call...',
    )
    for (const [, childFeature] of feature.children ?? new Map()) {
      const subFeature = this.getFeatureFromId(childFeature, featureId)
      if (subFeature) {
        return subFeature
      }
    }
    return null
  }

  /**
   * Get children's feature ids
   * @param feature - parent feature
   * @returns
   */
  getChildFeatureIds(feature: Feature | AnnotationFeatureSnapshot): string[] {
    if (!feature.children) {
      return []
    }
    const featureIds = []
    const children =
      feature.children instanceof Map
        ? feature.children
        : new Map(Object.entries(feature.children))
    for (const [childFeatureId, childFeature] of children || new Map()) {
      featureIds.push(childFeatureId, ...this.getChildFeatureIds(childFeature))
    }
    return featureIds
  }

  /**
   * Recursively assign new IDs to a feature
   * @param feature - Parent feature
   * @param featureIds -
   */
  generateNewIds(
    feature: Feature | AnnotationFeatureSnapshot,
    featureIds: string[],
  ): AnnotationFeatureSnapshot {
    const newId = new ObjectID().toHexString()
    featureIds.push(newId)

    const children: Record<string, AnnotationFeatureSnapshot> = {}
    if (feature.children) {
      for (const child of Object.values(feature.children)) {
        const newChild = this.generateNewIds(child, featureIds)
        children[newChild._id] = newChild
      }
    }
    const refSeq =
      typeof feature.refSeq === 'string'
        ? feature.refSeq
        : (feature.refSeq as unknown as Types.ObjectId).toHexString()

    return {
      // eslint-disable-next-line @typescript-eslint/no-misused-spread
      ...feature,
      refSeq,
      children: feature.children && children,
      _id: newId,
    }
  }

  addChild(parentFeature: Feature, child: AnnotationFeatureSnapshot) {
    if (!parentFeature.attributes?._id) {
      let { attributes } = parentFeature
      if (!attributes) {
        attributes = {}
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      attributes = {
        _id: [parentFeature._id.toString()],
        // eslint-disable-next-line unicorn/prefer-structured-clone
        ...JSON.parse(JSON.stringify(attributes)),
      }
      parentFeature.attributes = attributes
    }
    const { _id } = child
    if (!parentFeature.children) {
      parentFeature.children = new Map()
    }
    parentFeature.children.set(_id, {
      allIds: [],
      ...child,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      _id,
    })
    // Child features should be sorted for click and drag of gene glyphs to work properly
    parentFeature.children = new Map(
      [...parentFeature.children.entries()].sort((a, b) => a[1].min - b[1].min),
    )
  }
}
