import { AbstractSessionModel } from '@jbrowse/core/util'

import { BackendDriver } from '../BackendDrivers/BackendDriver'
import { ValidationSet } from '../Validations/ValidationSet'
import { Change } from './Change'

export class ChangeManager {
  constructor(
    private session: AbstractSessionModel,
    private validations: ValidationSet,
    private clientStore: any, // TODO add client store
    private view: any, // TODO add view model type
  ) {}

  async submit(change: Change) {
    // pre-validate
    const result = this.validations.frontendPreValidate(change)
    if (!result.ok) {
      this.session.notify(
        `Change is not valid: "${result.results
          .map((r) => r.error?.message)
          .filter(Boolean)
          .join(', ')}"`,
        'error',
      )
      return
    }

    // submit to client data store
    change.apply(this.clientStore)

    // post-validate
    const results2 = this.validations.frontendPostValidate(change)
    if (!results2.ok) {
      // notify of invalid change and revert
      change.getInverse().applyToClient(this.clientStore)
    }

    // submit to driver
    const backendDriver = this.view.backendDriver as BackendDriver
    const backendResult = backendDriver.submitChange(change)
    if (!backendResult.ok) {
      this.session.notify(
        `Change is not valid: "${result.results
          .map((r) => r.error?.message)
          .filter(Boolean)
          .join(', ')}"`,
        'error',
      )
      this.revert(change)
    }
  }

  async revert(change: Change) {
    return this.submit(change.getInverse())
  }
}
