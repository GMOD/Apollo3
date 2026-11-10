import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseAdapter,
  type BaseRefNameAliasAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'

import type { RefNameAliases } from '../BackendDrivers/BackendDriver'
import { isInWebWorker, requestFromMainThread } from '../mainThreadRequest'
import type { ApolloSessionModel } from '../session'

export default class RefNameAliasAdapter
  extends BaseAdapter
  implements BaseRefNameAliasAdapter
{
  private refNameAliasesP: Promise<RefNameAliases[]> | undefined

  /**
   * In a worker, concurrent callers share one request to the main thread. A
   * failed request isn't cached, so the next call tries again.
   */
  async getRefNameAliases() {
    const assemblyId = readConfObject(this.config, 'assemblyId') as string
    if (!isInWebWorker()) {
      const dataStore = (
        this.pluginManager?.rootModel?.session as ApolloSessionModel | undefined
      )?.apolloDataStore
      if (!dataStore) {
        throw new Error('No Apollo data store found')
      }
      const backendDriver = dataStore.getBackendDriver(assemblyId)
      if (!backendDriver) {
        throw new Error('No backend driver found')
      }
      return backendDriver.getRefNameAliases(assemblyId)
    }
    this.refNameAliasesP ??= requestFromMainThread('getRefNameAliases', {
      assembly: assemblyId,
    }).then(
      ({ refNameAliases }) => refNameAliases,
      (error: unknown) => {
        this.refNameAliasesP = undefined
        throw error
      },
    )
    return this.refNameAliasesP
  }

  freeResources() {
    // no resources to free
  }
}
