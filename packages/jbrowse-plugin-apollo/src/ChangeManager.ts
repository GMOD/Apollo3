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

import { ConfirmChangeDialog } from './ConfirmChangeDialog'
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
  undoneChanges: Change[] = []

  async submit(change: Change, opts: SubmitOpts = {}) {
    const {
      addToRecents = true,
      submitToBackend = true,
      updateJobsManager = false,
    } = opts
    // pre-validate
    const session = getSession(this.dataStore)
    const controller = new AbortController()

    const confirmation = new Promise<() => void>((resolve, reject) => {
      session.queueDialog((handleClose) => [
        ConfirmChangeDialog,
        { handleClose, resolve, reject },
      ])
    })

    let closeDialogCallback: () => void
    try {
      closeDialogCallback = await confirmation
    } catch {
      return
    }

    const { jobsManager, isLocked } = getSession(
      this.dataStore,
    ) as unknown as ApolloSessionModel

    if (isLocked) {
      session.notify('Cannot submit changes in locked mode')
      closeDialogCallback()
      return
    }

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
      closeDialogCallback()
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
      session.notify(
        `Error encountered in client: ${String(error)}. Data may be out of sync, please refresh the page`,
        'error',
      )
      closeDialogCallback()
      return
    }

    // post-validate
    const results2 = await validationRegistry.frontendPostValidate(
      change,
      this.dataStore,
    )
    if (!results2.ok) {
      // notify of invalid change and revert
      await this.undo(change)
    }

    if (submitToBackend) {
      if (updateJobsManager) {
        jobsManager.update(job.name, 'Submitting to driver')
      }
      // submit to driver
      const { collaborationServerDriver, getBackendDriver } = this.dataStore
      const backendDriver = isAssemblySpecificChange(change)
        ? // for assembly-specific change, fall back in case it's an
          // add-assembly change, since that won't exist in the driver yet
          getBackendDriver(change.assembly) ?? collaborationServerDriver
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
        await this.undo(change, false)
        closeDialogCallback()
        return
      }
      if (!backendResult.ok) {
        const msg = `Post-validation failed: "${result.resultsMessages}"`
        if (updateJobsManager) {
          jobsManager.abortJob(job.name, msg)
        }
        session.notify(msg, 'error')
        await this.undo(change, false)
        closeDialogCallback()
        return
      }
      if (change.notification) {
        session.notify(change.notification, 'success')
      }
      if (addToRecents) {
        this.recentChanges.push(change)
        this.undoneChanges = []
      }
    }

    if (updateJobsManager) {
      jobsManager.done(job)
    }
    closeDialogCallback()
  }

  async undo(change: Change, submitToBackend = true) {
    const inverseChange = change.getInverse()
    const opts = { submitToBackend, addToRecents: false }
    return this.submit(inverseChange, opts)
  }

  async redo(change: Change, submitToBackend = true) {
    const opts = { submitToBackend, addToRecents: false }
    return this.submit(change, opts)
  }

  async undoLastChange() {
    const session = getSession(this.dataStore)
    const lastChange = this.recentChanges.pop()
    if (!lastChange) {
      session.notify('No changes to undo!', 'info')
      return
    }
    this.undoneChanges.push(lastChange)
    return this.undo(lastChange)
  }

  async redoLastChange() {
    const session = getSession(this.dataStore)
    const lastChange = this.undoneChanges.pop()
    if (!lastChange) {
      session.notify('No changes to redo!', 'info')
      return
    }
    this.recentChanges.push(lastChange)
    return this.redo(lastChange)
  }
}
