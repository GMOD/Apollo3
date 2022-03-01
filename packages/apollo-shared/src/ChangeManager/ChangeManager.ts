import { getSession } from '@jbrowse/core/util'
import { IAnyStateTreeNode } from 'mobx-state-tree'

import {
  ValidationResultSet,
  ValidationSet,
} from '../Validations/ValidationSet'
import { Change, ClientDataStore } from './Change'

export class ChangeManager {
  constructor(
    private dataStore: ClientDataStore & IAnyStateTreeNode,
    private validations: ValidationSet,
  ) {}

  async submit(change: Change) {
    // pre-validate
    const session = getSession(this.dataStore)
    const result = await this.validations.frontendPreValidate(change)
    if (!result.ok) {
      session.notify(
        `Change is not valid: "${result.results
          .map((r) => r.error?.message)
          .filter(Boolean)
          .join(', ')}"`,
        'error',
      )
      return
    }

    // submit to client data store
    await change.apply(this.dataStore)

    // post-validate
    const results2 = await this.validations.frontendPostValidate(change)
    if (!results2.ok) {
      // notify of invalid change and revert
      this.revert(change)
    }

    // submit to driver
    const { backendDriver } = this.dataStore
    if (!backendDriver) {
      throw new Error(`No backendDriver set`)
    }
    let backendResult: ValidationResultSet
    try {
      backendResult = await backendDriver.submitChange(change)
    } catch (error) {
      session.notify(String(error), 'error')
      this.revert(change)
      return
    }
    if (!backendResult.ok) {
      session.notify(
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
    return change.getInverse().apply(this.dataStore)
  }
}
