import {
  type Change,
  isAssemblySpecificChange,
} from '@apollo-annotation/common'
import {
  type ValidationResultSet,
  validationRegistry,
} from '@apollo-annotation/shared'
import { getSession } from '@jbrowse/core/util'
import type { JobInput } from '@jbrowse/plugin-jobs-management'

import type { ApolloSessionModel } from './session'
import type { ClientDataStoreModel } from './session/ClientDataStore'
import { changeHandlers, isLocalChange } from './session/changeHandlers'

export interface SubmitOpts {
  /** defaults to true */
  submitToBackend?: boolean
  /** defaults to true */
  addToRecents?: boolean
  /** defaults to undefined */
  internetAccountId?: string
  /** defaults to false */
  updateJobStatusWidget?: boolean
}

export class ChangeManager {
  constructor(private dataStore: ClientDataStoreModel) {}

  recentChanges: Change[] = []
  undoneChanges: Change[] = []

  async submit(change: Change, opts: SubmitOpts = {}) {
    const {
      addToRecents = true,
      submitToBackend = true,
      updateJobStatusWidget = false,
    } = opts
    // pre-validate
    const session = getSession(this.dataStore)
    const controller = new AbortController()

    const {
      jobStatusWidget,
      isLocked,
      changeInProgress,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      setChangeInProgress,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      showJobStatusWidget,
    } = getSession(this.dataStore) as unknown as ApolloSessionModel

    if (isLocked) {
      session.notify('Cannot submit changes in locked mode')
      setChangeInProgress(false)
      return
    }

    if (changeInProgress) {
      session.notify(
        'Could not submit change, there is another change still in progress',
      )
      return
    }

    setChangeInProgress(true)

    const job: JobInput = {
      name: change.typeName,
      statusMessage: 'Pre-validating',
      progressPct: 0,
      cancelCallback: () => {
        controller.abort(
          new DOMException(
            `Cancelling change "${change.typeName}"`,
            'AbortError',
          ),
        )
      },
      state: 'running',
    }

    if (updateJobStatusWidget) {
      jobStatusWidget.addJob(job)
      showJobStatusWidget()
    }

    const result = await validationRegistry.frontendPreValidate(change)
    if (!result.ok) {
      const msg = `Pre-validation failed: "${result.resultsMessages}"`
      if (updateJobStatusWidget) {
        jobStatusWidget.addJob({
          name: job.name,
          statusMessage: msg,
          state: 'aborted',
        })
      }
      session.notify(msg, 'error')
      setChangeInProgress(false)
      return
    }

    const changeName = change.typeName
    const handler = isLocalChange(changeName)
      ? changeHandlers[changeName]
      : undefined
    if (handler) {
      try {
        // submit to client data store
        // @ts-expect-error change not narrowing
        await handler(this.dataStore, change)
      } catch (error) {
        if (updateJobStatusWidget) {
          jobStatusWidget.addJob({
            name: job.name,
            statusMessage: String(error),
            state: 'aborted',
          })
        }
        console.error(error)
        session.notify(
          `Error encountered in client: ${String(error)}. Data may be out of sync, please refresh the page`,
          'error',
        )
        setChangeInProgress(false)
        return
      }
    }

    // post-validate
    const results2 = await validationRegistry.frontendPostValidate(change)
    if (!results2.ok) {
      // notify of invalid change and revert
      await this.undo(change)
    }

    if (submitToBackend) {
      if (updateJobStatusWidget) {
        jobStatusWidget.updateJobStatus(job.name, 'Submitting to driver')
      }
      // submit to driver
      // eslint-disable-next-line @typescript-eslint/unbound-method
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
        if (updateJobStatusWidget) {
          jobStatusWidget.addJob({
            name: job.name,
            statusMessage: String(error),
            state: 'aborted',
          })
        }
        console.error(error)
        session.notify(String(error), 'error')
        setChangeInProgress(false)
        await this.undo(change, false)
        return
      }
      if (!backendResult.ok) {
        const msg = `Post-validation failed: "${result.resultsMessages}"`
        if (updateJobStatusWidget) {
          jobStatusWidget.addJob({
            name: job.name,
            statusMessage: msg,
            state: 'aborted',
          })
        }
        session.notify(msg, 'error')
        setChangeInProgress(false)
        await this.undo(change, false)
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

    if (updateJobStatusWidget) {
      jobStatusWidget.addJob({
        name: job.name,
        statusMessage: `Finished ${change.typeName}`,
        state: 'finished',
      })
    }
    setChangeInProgress(false)
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
