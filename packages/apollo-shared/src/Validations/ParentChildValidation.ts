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
  //   constructor(mins: number, maxs: number, mine: number, maxe: number) {
  //     this.minStart = mins | undefined
  //     this.maxStart = maxs
  //     this.minEnd = mine
  //     this.maxEnd = maxe
  //   }
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
    // console.log(`backendPreValidate: ${JSON.stringify(_change)}`)
    // const jsonObj = JSON.parse(JSON.stringify(_change))

    // // for (const [key, value] of Object.entries(_change)) {
    // //   console.log(`${key}: ${value}`)
    // // }
    // const { featureId } = jsonObj
    // console.log(`featureId: "${jsonObj.featureId}"`)
    // const parentFeatureWithChildren = FeatureService.findById(jsonObj.featureId)

    return { validationName: this.name }
  }

  async backendPostValidate(
    _change: Change,
    featureModel: Model<FeatureDocument>,
  ): Promise<ValidationResult> {
    console.log(`1. backendPostValidate: ${JSON.stringify(_change)}`)
    const jsonObj = JSON.parse(JSON.stringify(_change))

    // for (const [key, value] of Object.entries(_change)) {
    //   console.log(`${key}: ${value}`)
    // }
    const { featureId } = jsonObj
    console.log(`featureId: "${jsonObj.featureId}"`)
    const parentFeatureWithChildren = this.findById(
      jsonObj.featureId,
      featureModel,
    )
    console.log(`2. backendPostValidate: ${parentFeatureWithChildren}`)
    console.log(
      `3. backendPostValidate: ${JSON.stringify(parentFeatureWithChildren)}`,
    )

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
    console.log(`Feature found: ${JSON.stringify(foundFeature)}`)

    const minAndMax = new MinAndMaxValue()
    this.getMinAndMaxValue(foundFeature, featureId, minAndMax)
    console.log(
      `Min and max values are: ${minAndMax.minStart}, ${minAndMax.maxStart}, ${minAndMax.minEnd}, ${minAndMax.maxStart}`,
    )
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
    // console.log(`Top level featureId=${feature.featureId}`)
    if (feature.featureId === featureId) {
      //     console.log(
      //     `Top level featureId matches in object ${JSON.stringify(feature)}`,
      //   )
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    // console.log(
    //   `FeatureId was not found on top level so lets make recursive call...`,
    // )
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
   * Get single feature by featureId
   * @param featureObject -
   * @param featureId -
   * @returns
   */
  getMinAndMaxValue(
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
        console.log(`ChildFeatureLine start=${childFeatureLine.start}, end=${childFeatureLine.end}`)
        const subFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs | null =
          this.getMinAndMaxValue(
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
