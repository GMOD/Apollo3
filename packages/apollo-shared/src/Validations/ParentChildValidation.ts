import { FeatureDocument } from 'apollo-schemas'
import { ClientSession, Model } from 'mongoose'

import { Change, ClientDataStore } from '../ChangeManager/Change'
import { GFF3FeatureLineWithFeatureIdAndOptionalRefs } from '../ChangeManager/FeatureChange'
import soSequenceTypes from './soSequenceTypes'
import { Validation, ValidationResult } from './Validation'
import { isLocationEndChange, isLocationStartChange } from '..'

class StartEndValueClass {
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
    {
      session,
      featureModel,
    }: { session: ClientSession; featureModel: Model<FeatureDocument> },
  ): Promise<ValidationResult> {
    if (!(isLocationEndChange(change) || isLocationStartChange(change))) {
      return { validationName: this.name }
    }
    let featureId = ''
    for (const ch of change.changes) {
      console.log(`Change: ${JSON.stringify(ch)}`)
      console.log(`FeatureId: ${ch.featureId}`)
      // eslint-disable-next-line prefer-destructuring
      featureId = ch.featureId

      // Search correct feature
      const topLevelFeature = await featureModel
        .findOne({ featureIds: featureId })
        .session(session)
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
        const topLevelValues = new StartEndValueClass(
          topLevelId,
          '',
          topLevelFeature.start,
          topLevelFeature.end,
        )
        const arrayOfMinMaxValues = new Array<StartEndValueClass>()
        arrayOfMinMaxValues.push(topLevelValues)
        this.getMinMaxValues(topLevelFeature, arrayOfMinMaxValues)

        const clonedArray = new Array<StartEndValueClass>()
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
              if (clonedArray[j].myEnd > arrayOfMinMaxValues[i].myEnd) {
                throw new Error(
                  `Child's end value (${clonedArray[j].myEnd}) cannot be greater than parent's end value (${arrayOfMinMaxValues[i].myEnd})`,
                )
              }
              //   console.log(
              //     `Compare: "Child's parentId: "${arrayOfMinMaxValues[i].myId}". Is child's start (${clonedArray[j].myStart}) < parent's start (${arrayOfMinMaxValues[i].myStart}) ?`,
              //   )
              if (clonedArray[j].myStart < arrayOfMinMaxValues[i].myStart) {
                throw new Error(
                  `Child's start value (${clonedArray[j].myStart}) cannot be less than parent's start value (${arrayOfMinMaxValues[i].myStart})`,
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
    arrayOfMinAndMaxValues: Array<StartEndValueClass>,
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
          if (childFeatureLine.start && childFeatureLine.end) {
            const tmpClass = new StartEndValueClass(
              myId,
              myParentId,
              childFeatureLine.start,
              childFeatureLine.end,
            )
            arrayOfMinAndMaxValues.push(tmpClass)
          }
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
