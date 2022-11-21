import { getSession } from '@jbrowse/core/util'
import { IAnyStateTreeNode } from 'mobx-state-tree'

import {
  ValidationResultSet,
  validationRegistry,
} from '../Validations/ValidationSet'
import {
  AddAssemblyFromFileChange,
  AddFeatureChange,
  DeleteAssemblyChange,
  DeleteFeatureChange,
  LocationEndChange,
  LocationStartChange,
} from './changes'
import { Change, ClientDataStore } from './changes/abstract/Change'

export interface SubmitOpts {
  /** defaults to true */
  submitToBackend?: boolean
  /** defaults to true */
  addToRecents?: boolean
  /** defaults to undefined */
  internetAccountId?: string
}

export class ChangeManager {
  constructor(private dataStore: ClientDataStore & IAnyStateTreeNode) {}

  recentChanges: Change[] = []

  async submit(change: Change, opts: SubmitOpts = {}) {
    const { submitToBackend = true, addToRecents = true } = opts
    // pre-validate
    const session = getSession(this.dataStore)
    const result = await validationRegistry.frontendPreValidate(change)
    if (!result.ok) {
      session.notify(
        `Pre-validation failed: "${result.resultsMessages}"`,
        'error',
      )
      return
    }

    try {
      // submit to client data store
      await change.apply(this.dataStore)
    } catch (error) {
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
        backendResult = await backendDriver.submitChange(change, opts)
      } catch (error) {
        console.error(error)
        session.notify(String(error), 'error')
        this.revert(change, false)
        return
      }
      if (!backendResult.ok) {
        session.notify(
          `Post-validation failed: "${result.resultsMessages}"`,
          'error',
        )
        this.revert(change, false)
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
  }

  async submitToClientOnly(change: Change) {
    let ch

    const tmpObject: any = {
      ...change,
    }
    const { featureId, changedIds, assembly } = tmpObject

    // console.log(`CHANGE MANAGER: OBJECTI: ${JSON.stringify(tmpObject)}`)
    // console.log(`CHANGE MANAGER: TYPE: ${JSON.stringify(change.typeName)}`)
    switch (change.typeName) {
      case 'AddAssemblyFromFileChange':
        // console.log(
        //   `CHANGE MANAGER: AddAssemblyFromFileChange: Adding assembly ${JSON.stringify(
        //     assembly,
        //   )}`,
        // )
        ch = new AddAssemblyFromFileChange({
          typeName: 'AddAssemblyFromFileChange',
          assembly: tmpObject.assembly,
          assemblyName: tmpObject.assemblyName,
          changes: tmpObject,
        })
        break
      case 'AddFeatureChange':
        const { addedFeature } = tmpObject
        // console.log(
        //   `AddFeatureChange: Add feature ${JSON.stringify(addedFeature)}`,
        // )
        ch = new AddFeatureChange({
          typeName: 'AddFeatureChange',
          changedIds,
          addedFeature,
          assembly,
        })
        break
      case 'DeleteAssemblyChange':
        // console.log(
        //   `CHANGE MANAGER: DeleteAssemblyChange: Delete assembly ${JSON.stringify(
        //     assembly,
        //   )}`,
        // )
        ch = new DeleteAssemblyChange({
          typeName: 'DeleteAssemblyChange',
          assembly,
        })
        break
      case 'DeleteFeatureChange':
        const { parentFeatureId, deletedFeature } = tmpObject
        ch = new DeleteFeatureChange({
          typeName: 'DeleteFeatureChange',
          changedIds,
          deletedFeature,
          parentFeatureId,
          assembly,
        })
        break
      case 'LocationEndChange':
        const { oldEnd, newEnd } = tmpObject
        ch = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds,
          featureId,
          oldEnd,
          newEnd,
          assembly,
        })
        // console.log(`CHANGE MANAGER: LocationEndChange: ${JSON.stringify(ch)}`)
        break
      case 'LocationStartChange':
        const { oldStart, newStart } = tmpObject
        ch = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds,
          featureId,
          oldStart,
          newStart,
          assembly,
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
