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
      //   console.log(`NewEnd: ${ch.newEnd}`)
      featureId = ch.featureId
      newEnd = ch.newEnd

      // Search correct feature
      const topLevelFeature = await featureModel
        .findOne({ featureIds: featureId })
        .exec()

      if (!topLevelFeature) {
        const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
        //   this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      console.log(`TOP LEVEL FEATUREID: "${topLevelFeature.featureId}"`)
      console.log(`TOP LEVEL END: "${topLevelFeature.end}"`)
      const jsonObj = JSON.parse(JSON.stringify(topLevelFeature.attributes))
      console.log(`TOP LEVEL ATTRIBUTES: "${JSON.stringify(jsonObj)}"`)
      console.log(`TOP LEVEL ID: "${jsonObj.ID}"`)
      const topLevelId = jsonObj.ID

      //   const dummy1 = new EndValueClass('eka', '', 10, 20)
      //   const dummy2 = new EndValueClass('', 'eka', 10, 20)
      //   const eka1: string = dummy1.myId
      //   const toka1: string = dummy2.myParentId
      //   console.log(`+++++++++++++++++++++++++++++++: "${eka1 == toka1}", '${eka1}' == '${toka1}'`)
      //   const dummyArray = new Array<EndValueClass>()
      //   dummyArray.push(dummy1)
      //   dummyArray.push(dummy2)
      //   const eka11: string = dummyArray[0].myId
      //   const toka11: string = dummyArray[1].myParentId
      //   console.log(`+++++++++++++++++++++++++++++++: "${eka11 == toka11}", '${eka11}' == '${toka11}'`)

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

        for (const i in arrayOfMinMaxValues) {
          console.log(
            `ARRAY: myId: "${arrayOfMinMaxValues[i].myId}", myParentId: "${arrayOfMinMaxValues[i].myParentId}", myStart: "${arrayOfMinMaxValues[i].myStart}", myEnd: "${arrayOfMinMaxValues[i].myEnd}"`,
          )
        }
        for (let i = 0; i < arrayOfMinMaxValues.length; i++) {
          const outerId: string = JSON.stringify(arrayOfMinMaxValues[i].myId)
          console.log(
            `OUTER ARRAY: myId: "${outerId}", myParentId: "${arrayOfMinMaxValues[i].myParentId}", myStart: "${arrayOfMinMaxValues[i].myStart}", myEnd: "${arrayOfMinMaxValues[i].myEnd}"`,
          )
          for (let j = 0; j < clonedArray.length; j++) {
            const innerParentId: string = JSON.stringify(clonedArray[j].myParentId)
            // console.log(`${typeof outerId} ja ${typeof innerParentId}`)
            // console.log(
            //   `INNER ARRAY: outerId: "${outerId}", myParentId: "${innerParentId}", myStart: "${clonedArray[j].myStart}", myEnd: "${clonedArray[j].myEnd}"`,
            // )
            // console.log(
            //   `0 BOOLEAN: "${
            //     outerId == innerParentId
            //   }", '${outerId}' == '${innerParentId}'`,
            // )

            // if (outerId == innerParentId) {
            //   console.log('*** OUTERID === INNERPARENTID ***')
            // }
            // console.log(`1 BOOLEAN: "${outerId === innerParentId}"`)
            // console.log(`2 BOOLEAN: "${outerId == innerParentId}"`)
            // console.log(
            //   `3 BOOLEAN: "${
            //     (outerId as string) === (innerParentId as string)
            //   }"`,
            // )
            if (outerId === innerParentId) {
              console.log(
                `COMPARE: ("${arrayOfMinMaxValues[i].myId}" === "${arrayOfMinMaxValues[j].myParentId}") --> ONKO  "${arrayOfMinMaxValues[j].myEnd}" > "${arrayOfMinMaxValues[i].myEnd}"`,
              )
            }
          }
        }
        // for (const i in arrayOfMinMaxValues) {
        //   for (const j in arrayOfMinMaxValues) {
        //     console.log(
        //       `arrayOfMinMaxValues[i].myId: "${arrayOfMinMaxValues[i].myId}", arrayOfMinMaxValues[j].myParentId: "${arrayOfMinMaxValues[j].myParentId}"`,
        //     )
        //     if (
        //       arrayOfMinMaxValues[i].myId === arrayOfMinMaxValues[j].myParentId
        //     ) {
        //       console.log(
        //         `VERTAA: ("${arrayOfMinMaxValues[i].myId}" === "${arrayOfMinMaxValues[j].myParentId}") --> ONKO  "${arrayOfMinMaxValues[j].myEnd}" > "${arrayOfMinMaxValues[i].myEnd}"`,
        //       )
        //     }
        //   }
        // }
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
