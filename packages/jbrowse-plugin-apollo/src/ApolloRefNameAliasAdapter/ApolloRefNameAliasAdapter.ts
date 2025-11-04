import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseAdapter,
  type BaseRefNameAliasAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type RpcServer from 'librpc-web-mod/dist/server'
import { nanoid } from 'nanoid'

import { type ApolloSessionModel } from '../session'

import { type RefNameAliases } from './../BackendDrivers/BackendDriver'

declare global {
  const rpcServer: RpcServer
}

interface ApolloRefNameAliasMessage {
  apollo: true
  messageId: string
  refNameAliases: RefNameAliases[]
}

function isApolloRefNameAliasMessage(
  data?: unknown,
): data is ApolloRefNameAliasMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'apollo' in data &&
    data.apollo === true &&
    'refNameAliases' in data
  )
}

const isInWebWorker = typeof sessionStorage === 'undefined'

export default class RefNameAliasAdapter
  extends BaseAdapter
  implements BaseRefNameAliasAdapter
{
  private refNameAliases: RefNameAliases[] | undefined

  async getRefNameAliases() {
    const assemblyId = readConfObject(this.config, 'assemblyId') as string
    if (!isInWebWorker) {
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
      const refNameAliases = await backendDriver.getRefNameAliases(assemblyId)
      return refNameAliases
    }
    const refNameAliases = await new Promise(
      (
        resolve: (refNameAliases: RefNameAliases[]) => void,
        reject: (reason: Error) => void,
      ) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('timeout'))
        }, 20_000)
        const messageId = nanoid()
        const messageListener = (event: MessageEvent) => {
          const data = event.data as ApolloRefNameAliasMessage
          if (!isApolloRefNameAliasMessage(data)) {
            return
          }
          if (data.messageId !== messageId) {
            return
          }
          clearTimeout(timeoutId)
          removeEventListener('message', messageListener)
          resolve(data.refNameAliases)
        }
        addEventListener('message', messageListener)
        rpcServer.emit('apollo', {
          apollo: true,
          method: 'getRefNameAliases',
          assembly: assemblyId,
          messageId,
        })
      },
    )
    this.refNameAliases = refNameAliases
    return refNameAliases
  }

  freeResources() {
    // no resources to free
  }
}
