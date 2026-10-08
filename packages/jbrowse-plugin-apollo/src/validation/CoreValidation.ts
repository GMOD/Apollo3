import type { Change } from '@apollo-annotation/common'
import { ClientValidation } from '@apollo-annotation/common/client'
import type { TypeChange } from '@apollo-annotation/shared'

import soSequenceTypes from './soSequenceTypes'

function isTypeChange(thing: Change): thing is TypeChange {
  return 'oldType' in thing && 'newType' in thing
}

/** Only allows feature types that are SO sequence_feature terms */
export class CoreValidation extends ClientValidation {
  name = 'Core'

  preValidate(change: Change) {
    if (!isTypeChange(change)) {
      return
    }
    for (const subChange of change.changes) {
      if (!soSequenceTypes.includes(subChange.newType)) {
        return `"${subChange.newType}" is not a valid SO sequence_feature term`
      }
    }
    return
  }
}
