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
import {
  LocationEndChange,
  LocationEndChangeDetails,
  isLocationEndChange,
} from '..'

// class MinAndMaxValue {
//   minStart: number | undefined
//   maxStart: number | undefined
//   minEnd: number | undefined
//   maxEnd: number | undefined
// }

class EndValueClass {
  myId: string
  myParentId: string
  myStart: number
  myEnd: number

  constructor(
    myId: string,
    myParentId: string,
    myStart: number,
    myEnd: number,
  ) {
    this.myId = myId
    this.myParentId = myParentId
    this.myStart = myStart
    this.myEnd = myEnd
  }
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
    change: Change,
    featureModel: Model<FeatureDocument>,
  ): Promise<ValidationResult> {
    if (!isLocationEndChange(change)) {
      return { validationName: this.name }
    }
    let featureId = ''
    let newEnd = -1
    for (const ch of change.changes) {
      console.log(`Change: ${JSON.stringify(ch)}`)
      console.log(`FeatureId: ${ch.featureId}`)
      featureId = ch.featureId
      newEnd = ch.newEnd

      // Search correct feature
      const topLevelFeature = await featureModel
        .findOne({ featureIds: featureId })
        .exec()

      if (!topLevelFeature) {
        const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
        throw new Error(errMsg)
      }
      console.log(`Top level featureId: "${topLevelFeature.featureId}"`)
      const jsonObj = JSON.parse(JSON.stringify(topLevelFeature.attributes))
      console.log(`Top level attributes: "${JSON.stringify(jsonObj)}"`)
      const topLevelId = jsonObj.ID

      // Check start and end validations only if there is hierachy
      if (topLevelId) {
        const topLevelValues = new EndValueClass(
          topLevelId,
          '',
          topLevelFeature.start,
          topLevelFeature.end,
        )
        const arrayOfMinMaxValues = new Array<EndValueClass>()
        arrayOfMinMaxValues.push(topLevelValues)
        this.getMinMaxValues(topLevelFeature, arrayOfMinMaxValues)

        const clonedArray = new Array<EndValueClass>()
        arrayOfMinMaxValues.forEach((val) =>
          clonedArray.push(Object.assign({}, val)),
        )

        // Print whole array
        for (const i in arrayOfMinMaxValues) {
          console.log(
            `Array[${i}]: myId: "${arrayOfMinMaxValues[i].myId}", parentId: "${arrayOfMinMaxValues[i].myParentId}", myStart: "${arrayOfMinMaxValues[i].myStart}", myEnd: "${arrayOfMinMaxValues[i].myEnd}"`,
          )
        }

        // Loop and compare
        for (let i = 0; i < arrayOfMinMaxValues.length; i++) {
          const outerId: string = JSON.stringify(arrayOfMinMaxValues[i].myId)
          for (let j = i + 1; j < clonedArray.length; j++) {
            const innerParentId: string = JSON.stringify(
              clonedArray[j].myParentId,
            )
            if (outerId === innerParentId) {
              console.log(
                `Compare: "Child's parentId: "${arrayOfMinMaxValues[i].myId}". Is child's end (${clonedArray[j].myEnd}) > parent's end (${arrayOfMinMaxValues[i].myEnd}) ?`,
              )
              if (clonedArray[j].myEnd > arrayOfMinMaxValues[i].myEnd) {
                throw new Error(
                  `Child's end value (${clonedArray[j].myEnd}) cannot be greater than parent's end value (${arrayOfMinMaxValues[i].myEnd})`,
                )
              }
            }
          }
        }
      }
    }
    return { validationName: this.name }
  }

  /**
   * Get children's min and max start and end values
   * @param featureObject -
   * @param featureId -
   * @returns - class of min and max values
   */
  getMinMaxValues(
    feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
    arrayOfMinAndMaxValues: Array<EndValueClass>,
  ): GFF3FeatureLineWithFeatureIdAndOptionalRefs | null {
    for (const childFeature of feature.child_features || []) {
      for (const childFeatureLine of childFeature) {
        if (childFeatureLine && childFeatureLine.attributes) {
          let myId = ''
          let myParentId = ''
          if (childFeatureLine.attributes.ID) {
            myId = childFeatureLine.attributes.ID as unknown as string
          }
          if (childFeatureLine.attributes.Parent) {
            myParentId = childFeatureLine.attributes.Parent as unknown as string
          }
          const tmpClass = new EndValueClass(
            myId,
            myParentId,
            childFeatureLine.start!,
            childFeatureLine.end!,
          )
          arrayOfMinAndMaxValues.push(tmpClass)
        }
        const subFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs | null =
          this.getMinMaxValues(
            childFeatureLine as GFF3FeatureLineWithFeatureIdAndOptionalRefs,
            arrayOfMinAndMaxValues,
          )
        if (subFeature) {
          return subFeature
        }
      }
    }
    return null
  }

  async possibleValues(key: string) {
    if (key === 'type') {
      return soSequenceTypes
    }
    return undefined
  }
}
