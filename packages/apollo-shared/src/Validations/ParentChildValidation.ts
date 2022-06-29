import { FeatureDocument } from 'apollo-schemas'
import { Model } from 'mongoose'

import {
  Change,
  ClientDataStore,
  SerializedChange,
} from '../ChangeManager/Change'
import {
  FeatureChange,
  GFF3FeatureLineWithFeatureIdAndOptionalRefs,
} from '../ChangeManager/FeatureChange'
import { TypeChange } from '../ChangeManager/TypeChange'
import soSequenceTypes from './soSequenceTypes'
import { Validation, ValidationResult } from './Validation'
import { LocationEndChange, LocationEndChangeDetails } from '..'

class MinAndMaxValue {
  minStart: number | undefined
  maxStart: number | undefined
  minEnd: number | undefined
  maxEnd: number | undefined
}

export class ParentChildValidation extends Validation {
  name = 'Core' as const
  logger!: import('@nestjs/common').LoggerService

  async validateParentChildRelationships() {
    return
  }

  async frontendPreValidate(_change: Change): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async frontendPostValidate(
    _change: Change,
    _dataStore: ClientDataStore,
  ): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async backendPreValidate(_change: Change): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async backendPostValidate(
    _change: Change,
    featureModel: Model<FeatureDocument>,
  ): Promise<ValidationResult> {
    let featureId = ''
    let newEnd = -1
    console.log(`backendPostValidate - change: ${JSON.stringify(_change)}`)
    for (const [key, value] of Object.entries(_change)) {
      if (key === 'changes') {
        const allChanges = JSON.parse(JSON.stringify(value))
        for (const ch of allChanges) {
          console.log(`Change: ${JSON.stringify(ch)}`)
          console.log(`FeatureId: ${ch.featureId}`)
          console.log(`NewEnd: ${ch.newEnd}`)
          featureId = ch.featureId
          newEnd = ch.newEnd

          const parentFeatureWithChildren = await this.findById(
            featureId,
            featureModel,
          )
          // console.log(`Feature found: ${JSON.stringify(parentFeatureWithChildren)}`)

          const minAndMax = new MinAndMaxValue()
          this.getChildrenMinAndMaxValsue(
            parentFeatureWithChildren,
            featureId,
            minAndMax,
          )
          console.log(
            `Feature's start ${parentFeatureWithChildren.start} and end ${parentFeatureWithChildren.end}`,
          )
          console.log(
            `Children's minStart is ${minAndMax.minStart}, maxStart ${minAndMax.maxStart}, minEnd ${minAndMax.minEnd} and maxEnd ${minAndMax.maxEnd}`,
          )
          if (!minAndMax.maxEnd) {
            throw new Error('There is no max end value for children')
          }
          if (minAndMax.maxEnd > newEnd) {
            throw new Error(
              `Children's maxEnd value (${minAndMax.maxEnd}) cannot be greater than new set end value (${newEnd})`,
            )
          }
        }
      }
    }
    return { validationName: this.name }
  }

  async possibleValues(key: string) {
    if (key === 'type') {
      return soSequenceTypes
    }
    return undefined
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureid - featureId
   * @returns Return the feature(s) if search was successful. Otherwise throw exception
   */
  async findById(featureId: string, featureModel: Model<FeatureDocument>) {
    // Search correct feature
    const topLevelFeature = await featureModel
      .findOne({ featureIds: featureId })
      .exec()

    if (!topLevelFeature) {
      const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
      //   this.logger.error(errMsg)
      throw new Error(errMsg)
    }

    // Now we need to find correct top level feature or sub-feature inside the feature
    const foundFeature = this.getObjectByFeatureId(topLevelFeature, featureId)
    if (!foundFeature) {
      const errMsg = `ERROR when searching feature by featureId`
      //   this.logger.error(errMsg)
      throw new Error(errMsg)
    }
    return foundFeature
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
    if (feature.featureId === featureId) {
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
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

  /**
   * Get children's min and max start and end values
   * @param featureObject -
   * @param featureId -
   * @returns - class of min and max values
   */
  getChildrenMinAndMaxValsue(
    feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
    featureId: string,
    minAndMaxValues: MinAndMaxValue,
  ): GFF3FeatureLineWithFeatureIdAndOptionalRefs | null {
    for (const childFeature of feature.child_features || []) {
      for (const childFeatureLine of childFeature) {
        if (
          childFeatureLine.start &&
          (!minAndMaxValues.minStart ||
            childFeatureLine.start < minAndMaxValues.minStart)
        ) {
          minAndMaxValues.minStart = childFeatureLine.start
        }
        if (
          childFeatureLine.start &&
          (!minAndMaxValues.maxStart ||
            childFeatureLine.start > minAndMaxValues.maxStart)
        ) {
          minAndMaxValues.maxStart = childFeatureLine.start
        }
        if (
          childFeatureLine.end &&
          (!minAndMaxValues.minEnd ||
            childFeatureLine.end < minAndMaxValues.minEnd)
        ) {
          minAndMaxValues.minEnd = childFeatureLine.end
        }
        if (
          childFeatureLine.end &&
          (!minAndMaxValues.maxEnd ||
            childFeatureLine.end > minAndMaxValues.maxEnd)
        ) {
          minAndMaxValues.maxEnd = childFeatureLine.end
        }
        const subFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs | null =
          this.getChildrenMinAndMaxValsue(
            childFeatureLine as GFF3FeatureLineWithFeatureIdAndOptionalRefs,
            featureId,
            minAndMaxValues,
          )
        if (subFeature) {
          return subFeature
        }
      }
    }
    return null
  }
}
