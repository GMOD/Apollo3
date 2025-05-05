/* eslint-disable @typescript-eslint/require-await */
import { Change } from '@apollo-annotation/common'

import { TypeChange } from '../Changes'

import { Validation } from './Validation'
import soSequenceTypes from './soSequenceTypes'

export function isTypeChange(thing: Change): thing is TypeChange {
  return 'oldType' in thing && 'newType' in thing
}

export class CoreValidation extends Validation {
  name = 'Core' as const

  async frontendPreValidate(change: Change) {
    if (isTypeChange(change)) {
      for (const subChange of change.changes) {
        if (!soSequenceTypes.includes(subChange.newType)) {
          return {
            validationName: this.name,
            error: {
              message: `"${subChange.newType}" is not a valid SO sequence_feature term`,
            },
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
    return
  }
}
