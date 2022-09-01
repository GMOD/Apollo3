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
    public validations: ValidationSet,
  ) {}

  recentChanges: Change[] = []

  async submit(change: Change, submitToBackend = true, addToRecents = true) {
    console.log(({change}))
    // pre-validate
    const session = getSession(this.dataStore)
    const result = await this.validations.frontendPreValidate(change)
    if (!result.ok) {
      session.notify(
        `Pre-validation failed: "${result.results
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
    const results2 = await this.validations.frontendPostValidate(
      change,
      this.dataStore,
    )
    if (!results2.ok) {
      // notify of invalid change and revert
      this.revert(change)
    }

    if (submitToBackend) {
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
        this.revert(change, false)
        return
      }
      if (!backendResult.ok) {
        session.notify(
          `Post-validation failed: "${result.results
            .map((r) => r.error?.message)
            .filter(Boolean)
            .join(', ')}"`,
          'error',
        )
        this.revert(change, false)
      }
    }
    if (addToRecents) {
      // Push the change into array
      this.recentChanges.push(change)
    }
  }

  async revert(change: Change, submitToBackend = true) {
    const inverseChange = change.getInverse()
    return this.submit(inverseChange, submitToBackend, false)
  }

  /**
   * Undo the last change
   */
  async revertLastChange() {
    const lastChange = this.recentChanges.pop()
    if (!lastChange) {
      const session = getSession(this.dataStore)
      session.notify('No changes to undo!', 'warning')
      return
    }
    return this.revert(lastChange)
  }
}
