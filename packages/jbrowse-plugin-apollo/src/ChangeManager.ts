/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  type Change,
  type ClientDataStore,
  isAssemblySpecificChange,
} from '@apollo-annotation/common'
import {
  type ValidationResultSet,
  validationRegistry,
} from '@apollo-annotation/shared'
import { getSession } from '@jbrowse/core/util'
import { type IAnyStateTreeNode } from 'mobx-state-tree'

import { type ApolloSessionModel } from './session'

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
    const {
      addToRecents = true,
      submitToBackend = true,
      updateJobsManager = false,
    } = opts
    // pre-validate
    const session = getSession(this.dataStore)
    const controller = new AbortController()

    const { jobsManager } = getSession(
      this.dataStore,
    ) as unknown as ApolloSessionModel

    const job = {
      name: change.typeName,
      statusMessage: 'Pre-validating',
      progressPct: 0,
      cancelCallback: () => {
        controller.abort()
      },
    }

    if (updateJobsManager) {
      jobsManager.runJob(job)
    }

    const result = await validationRegistry.frontendPreValidate(change)
    if (!result.ok) {
      const msg = `Pre-validation failed: "${result.resultsMessages}"`
      if (updateJobsManager) {
        jobsManager.abortJob(job.name, msg)
      }
      session.notify(msg, 'error')
      return
    }

    try {
      // submit to client data store
      await change.execute(this.dataStore)
    } catch (error) {
      if (updateJobsManager) {
        jobsManager.abortJob(job.name, String(error))
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
        jobsManager.update(job.name, 'Submitting to driver')
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
          jobsManager.abortJob(job.name, String(error))
        }
        console.error(error)
        session.notify(String(error), 'error')
        await this.revert(change, false)
        return
      }
      if (!backendResult.ok) {
        const msg = `Post-validation failed: "${result.resultsMessages}"`
        if (updateJobsManager) {
          jobsManager.abortJob(job.name, msg)
        }
        session.notify(msg, 'error')
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
      jobsManager.done(job)
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
