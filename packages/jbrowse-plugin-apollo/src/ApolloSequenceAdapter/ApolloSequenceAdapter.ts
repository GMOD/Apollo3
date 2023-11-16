import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { NoAssemblyRegion, Region } from '@jbrowse/core/util/types'
import { nanoid } from 'nanoid'

import { BackendDriver } from '../BackendDrivers'
import { ApolloSessionModel } from '../session'

// declare global {
//   var rpcServer: import('librpc-web-mod').RpcServer
// }

export interface RefSeq {
  _id: string
  name: string
  description: string
  length: number
}

interface ApolloMessageData {
  apollo: true
  messageId: string
  sequence: string
  regions: Region[]
}

function isApolloMessageData(data?: unknown): data is ApolloMessageData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'apollo' in data &&
    data.apollo === true
  )
}

const isInWebWorker = typeof sessionStorage === 'undefined'

export class ApolloSequenceAdapter extends BaseSequenceAdapter {
  private regions: NoAssemblyRegion[] | undefined

  public async getRefNames(opts: BaseOptions) {
    const regions = await this.getRegions(opts)
    return regions.map((regions) => regions.refName)
  }

  public async getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]> {
    if (this.regions) {
      return this.regions
    }
    const assemblyId = readConfObject(this.config, 'assemblyId')
    if (!isInWebWorker) {
      const dataStore = (
        this.pluginManager?.rootModel?.session as ApolloSessionModel | undefined
      )?.apolloDataStore
      if (!dataStore) {
        throw new Error('No Apollo data store found')
      }
      const backendDriver = dataStore.getBackendDriver(
        assemblyId,
      ) as BackendDriver
      const regions = await backendDriver.getRegions(assemblyId)
      this.regions = regions
      return regions
    }
    const { signal } = opts
    const regions = await new Promise(
      (
        resolve: (sequence: Region[]) => void,
        reject: (reason: string) => void,
      ) => {
        const timeoutId = setTimeout(() => {
          reject('timeout')
        }, 20_000)
        const messageId = nanoid()
        const messageListener = (event: MessageEvent) => {
          const { data } = event
          if (!isApolloMessageData(data)) {
            return
          }
          if (data.messageId !== messageId) {
            return
          }
          clearTimeout(timeoutId)
          removeEventListener('message', messageListener)
          resolve(data.regions)
        }
        addEventListener('message', messageListener, { signal })
        // @ts-expect-error waiting for types to be published
        globalThis.rpcServer.emit('apollo', {
          apollo: true,
          method: 'getRegions',
          assembly: assemblyId,
          messageId,
        })
      },
    )
    this.regions = regions
    return regions
  }

  /**
   * Fetch features for a certain region
   * @param param -
   * @returns Observable of Feature objects in the region
   */
  public getFeatures(region: Region, opts: BaseOptions) {
    const { signal } = opts
    const { assemblyName, end, refName, start } = region
    return ObservableCreate<Feature>(async (observer) => {
      if (!isInWebWorker) {
        const dataStore = (
          this.pluginManager?.rootModel?.session as
            | ApolloSessionModel
            | undefined
        )?.apolloDataStore
        if (!dataStore) {
          observer.error('No Apollo data store found')
          return
        }
        const backendDriver = dataStore.getBackendDriver(
          assemblyName,
        ) as BackendDriver
        const { seq } = await backendDriver.getSequence(region)
        observer.next(
          new SimpleFeature({
            id: `${refName} ${start}-${end}`,
            data: { refName, start, end, seq },
          }),
        )
        observer.complete()
        return
      }
      const seq = await new Promise(
        (
          resolve: (sequence: string) => void,
          reject: (reason: string) => void,
        ) => {
          const timeoutId = setTimeout(() => {
            reject('timeout')
          }, 20_000)
          const messageId = nanoid()
          const messageListener = (event: MessageEvent) => {
            const { data } = event
            if (!isApolloMessageData(data)) {
              return
            }
            if (data.messageId !== messageId) {
              return
            }
            clearTimeout(timeoutId)
            removeEventListener('message', messageListener)
            resolve(data.sequence)
          }
          addEventListener('message', messageListener, { signal })
          // @ts-expect-error waiting for types to be published
          globalThis.rpcServer.emit('apollo', {
            apollo: true,
            method: 'getSequence',
            region,
            messageId,
          })
        },
      )
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
