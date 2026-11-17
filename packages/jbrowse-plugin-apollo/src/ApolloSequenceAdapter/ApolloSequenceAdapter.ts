import { readConfObject } from '@jbrowse/core/configuration'
import {
  type BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { type Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion, Region } from '@jbrowse/core/util/types'

import { isInWebWorker, requestFromMainThread } from '../mainThreadRequest'
import type { ApolloSessionModel } from '../session'

export interface RefSeq {
  _id: string
  name: string
  description: string
  length: number
}

export class ApolloSequenceAdapter extends BaseSequenceAdapter {
  private regionsP: Promise<NoAssemblyRegion[]> | undefined

  public async getRefNames() {
    const regions = await this.getRegions()
    return regions.map((regions) => regions.refName)
  }

  /**
   * Concurrent callers share one request. A failed request isn't cached, so
   * the next call tries again.
   */
  public getRegions(): Promise<NoAssemblyRegion[]> {
    this.regionsP ??= this.fetchRegions().catch((error: unknown) => {
      this.regionsP = undefined
      throw error
    })
    return this.regionsP
  }

  private async fetchRegions(): Promise<NoAssemblyRegion[]> {
    const assemblyId = readConfObject(this.config, 'assemblyId') as string
    if (!isInWebWorker()) {
      return this.getBackendDriver(assemblyId).getRegions(assemblyId)
    }
    const { regions } = await requestFromMainThread('getRegions', {
      assembly: assemblyId,
    })
    return regions
  }

  private getBackendDriver(assemblyId: string) {
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
    return backendDriver
  }

  /**
   * Fetch features for a certain region
   * @param param -
   * @returns Observable of Feature objects in the region
   */
  public getFeatures(region: Region, opts?: BaseOptions) {
    const { end, refName, start } = region
    const assemblyId = readConfObject(this.config, 'assemblyId') as string
    const regionWithAssemblyName = { ...region, assemblyName: assemblyId }
    return ObservableCreate<Feature>(async (observer) => {
      let seq: string
      if (isInWebWorker()) {
        ;({ sequence: seq } = await requestFromMainThread(
          'getSequence',
          { region: regionWithAssemblyName },
          { signal: opts?.signal, stopToken: opts?.stopToken },
        ))
      } else {
        const backendDriver = this.getBackendDriver(assemblyId)
        const regions = await backendDriver.getRegions(assemblyId)
        const fullRegion = regions.find((r) => r.refName === refName)
        if (!fullRegion) {
          throw new Error('Cannot get region')
        }
        if (regionWithAssemblyName.end > fullRegion.end) {
          regionWithAssemblyName.end = fullRegion.end
        }
        ;({ seq } = await backendDriver.getSequence(regionWithAssemblyName))
      }
      observer.next(
        new SimpleFeature({
          id: `${refName} ${start}-${end}`,
          data: { refName, start, end, seq },
        }),
      )
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the foreseeable future and can be purged
   * from caches, etc
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public freeResources(/* { region } */): void {}
}
