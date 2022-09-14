import { getSession } from '@jbrowse/core/util'
import { IAnyStateTreeNode } from 'mobx-state-tree'

import {
  ValidationResultSet,
  ValidationSet,
} from '../Validations/ValidationSet'
import { Change, ClientDataStore } from './Change'
import { CopyFeatureChange } from './CopyFeatureChange'
import { DeleteFeatureChange } from './DeleteFeatureChange'
import { LocationEndChange } from './LocationEndChange'
import { LocationStartChange } from './LocationStartChange'

export class ChangeManager {
  constructor(
    private dataStore: ClientDataStore & IAnyStateTreeNode,
    public validations: ValidationSet,
  ) {}

  recentChanges: Change[] = []

  async submit(change: Change, submitToBackend = true, addToRecents = true) {
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

  async submitToClientOnly(change: Change) {
    let ch

    const tmpObject: any = {
      ...change,
    }
    const { featureId } = tmpObject

    switch (change.typeName) {
      case 'LocationEndChange':
        const { oldEnd, newEnd } = tmpObject
        ch = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: change.changedIds,
          featureId,
          oldEnd,
          newEnd,
          assemblyId: change.assemblyId,
        })
        break
      case 'LocationStartChange':
        const { oldStart, newStart } = tmpObject
        ch = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: change.changedIds,
          featureId,
          oldStart,
          newStart,
          assemblyId: change.assemblyId,
        })
        break
      case 'DeleteFeatureChange':
        const { parentFeatureId } = tmpObject
        ch = new DeleteFeatureChange({
          typeName: 'DeleteFeatureChange',
          changedIds: change.changedIds,
          deletedFeature: featureId,
          parentFeatureId,
          assemblyId: change.assemblyId,
        })
        break
      case 'CopyFeatureChange':
        const { targetAssemblyId } = tmpObject
        ch = new CopyFeatureChange({
          typeName: 'CopyFeatureChange',
          changedIds: change.changedIds,
          targetAssemblyId,
          featureId,
          assemblyId: change.assemblyId,
        })
        break
    }

    // submit to client data store
    await ch?.apply(this.dataStore)
    // Push the change into array
    this.recentChanges.push(change)
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
