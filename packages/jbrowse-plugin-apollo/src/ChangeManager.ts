import { getSession } from '@jbrowse/core/util'
import {
  Change,
  ClientDataStore,
  isAssemblySpecificChange,
} from 'apollo-common'
import { ValidationResultSet, validationRegistry } from 'apollo-shared'
import { IAnyStateTreeNode } from 'mobx-state-tree'

export interface SubmitOpts {
  /** defaults to true */
  submitToBackend?: boolean
  /** defaults to true */
  addToRecents?: boolean
  /** defaults to undefined */
  internetAccountId?: string
  /** defaults to false */
  updateJobsManager?: boolean
}

export class ChangeManager {
  constructor(private dataStore: ClientDataStore & IAnyStateTreeNode) {}

  recentChanges: Change[] = []

  async submit(change: Change, opts: SubmitOpts = {}) {
    const { addToRecents = true, submitToBackend = true, updateJobsManager = false } = opts
    // pre-validate
    const session = getSession(this.dataStore)
    const { jobsManager } = session

    if (updateJobsManager) {
      jobsManager.runJob({
        name: `${change.typeName}`,
        statusMessage: 'Pre-validating',
        progressPct: 0,
        cancelCallback: () => jobsManager.abortJob(),
      })
    }

    const result = await validationRegistry.frontendPreValidate(change)
    if (!result.ok) {
      const msg = `Pre-validation failed: "${result.resultsMessages}"`
      if (updateJobsManager) {
        jobsManager.abortJob(msg)
      }
      session.notify(
        msg,
        'error',
      )
      return
    }

    try {
      // submit to client data store
      await change.execute(this.dataStore)
    } catch (error) {
      if (updateJobsManager) {
        jobsManager.abortJob(String(error))
      }
      console.error(error)
      session.notify(String(error), 'error')
      return
    }

    // post-validate
    const results2 = await validationRegistry.frontendPostValidate(
      change,
      this.dataStore,
    )
    if (!results2.ok) {
      // notify of invalid change and revert
      await this.revert(change)
    }

    if (submitToBackend) {
      if (updateJobsManager) {
        // seen, add an increment here
        jobsManager.update(
          'Submitting to driver'
        )
      }
      // submit to driver
      const { collaborationServerDriver, getBackendDriver } = this.dataStore
      const backendDriver = isAssemblySpecificChange(change)
        ? getBackendDriver(change.assembly)
        : collaborationServerDriver
      let backendResult: ValidationResultSet
      try {
        backendResult = await backendDriver.submitChange(change, opts)
      } catch (error) {
        if (updateJobsManager) {
          jobsManager.abortJob(String(error))
        }
        console.error(error)
        session.notify(String(error), 'error')
        await this.revert(change, false)
        return
      }
      if (!backendResult.ok) {
        const msg = `Post-validation failed: "${result.resultsMessages}"`
        if (updateJobsManager) {
          jobsManager.abortJob(msg)
        }
        session.notify(
          msg,
          'error',
        )
        await this.revert(change, false)
        return
      }
      if (change.notification) {
        session.notify(change.notification, 'success')
      }
    }
    if (addToRecents) {
      // Push the change into array
      this.recentChanges.push(change)
    }

    if (updateJobsManager) {
      jobsManager.done()
    }
  }

  async revert(change: Change, submitToBackend = true) {
    const inverseChange = change.getInverse()
    return this.submit(inverseChange, { submitToBackend, addToRecents: false })
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
