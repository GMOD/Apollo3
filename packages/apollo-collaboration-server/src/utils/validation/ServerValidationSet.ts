import {
  type Change,
  type ChangeRule,
  isChangeRule,
} from '@apollo-annotation/common'
import type {
  ServerPostValidationContext,
  ServerValidation,
  ServerValidationContext,
} from '@apollo-annotation/common/server'
import { runValidations } from '@apollo-annotation/shared'

/** The change rules and server validations that changes are checked against */
export class ServerValidationSet {
  readonly rules = new Set<ChangeRule>()
  readonly validations = new Set<ServerValidation>()

  register(validation: ChangeRule | ServerValidation) {
    if (isChangeRule(validation)) {
      this.rules.add(validation)
    } else {
      this.validations.add(validation)
    }
  }

  /** Run change rules, then server validations, before a change is applied */
  async preValidate(change: Change, context: ServerValidationContext) {
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

  /** Run server validations after a change is applied */
  async postValidate(change: Change, context: ServerPostValidationContext) {
    return runValidations(this.validations, (validation) =>
      validation.postValidate?.(change, context),
    )
  }
}

/** All change rules and server validations registered on this server */
export const serverValidations = new ServerValidationSet()
