import {
  type Change,
  type ChangeRule,
  isChangeRule,
} from '@apollo-annotation/common'
import type {
  ClientValidation,
  ClientValidationContext,
} from '@apollo-annotation/common/client'
import { runValidations } from '@apollo-annotation/shared'

/** The change rules and client validations that changes are checked against */
export class ClientValidationSet {
  readonly rules = new Set<ChangeRule>()
  readonly validations = new Set<ClientValidation>()

  register(validation: ChangeRule | ClientValidation) {
    if (isChangeRule(validation)) {
      this.rules.add(validation)
    } else {
      this.validations.add(validation)
    }
  }

  /** Run change rules, then client validations, before a change is applied */
  async preValidate(change: Change, context: ClientValidationContext) {
    const ruleResults = await runValidations(this.rules, (rule) =>
      rule.validate(change),
    )
    if (!ruleResults.ok) {
      return ruleResults
    }
    return runValidations(this.validations, (validation) =>
      validation.preValidate?.(change, context),
    )
  }

  /** Run client validations after a change is applied in the client */
  async postValidate(change: Change, context: ClientValidationContext) {
    return runValidations(this.validations, (validation) =>
      validation.postValidate?.(change, context),
    )
  }
}

/** All change rules and client validations registered in this client */
export const clientValidations = new ClientValidationSet()
