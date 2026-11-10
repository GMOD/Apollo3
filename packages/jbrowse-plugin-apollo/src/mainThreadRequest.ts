import { checkStopToken } from '@jbrowse/core/util'
import type { NoAssemblyRegion, Region } from '@jbrowse/core/util/types'
import type RpcServer from 'librpc-web-mod/dist/server'
import { nanoid } from 'nanoid'

import type { RefNameAliases } from './BackendDrivers/BackendDriver'

declare global {
  const rpcServer: RpcServer
}

/** How long a worker waits for the main thread to answer a request */
export const MAIN_THREAD_REQUEST_TIMEOUT_MS = 20_000

/** How often a pending request checks whether JBrowse has cancelled it */
const STOP_TOKEN_CHECK_INTERVAL_MS = 1000

export interface MainThreadRequestOptions {
  signal?: AbortSignal
  /** JBrowse's cancellation token, which can only be polled */
  stopToken?: string
}

/** The requests a worker can make, and the reply each one gets */
export interface MainThreadRequests {
  getRegions: {
    params: { assembly: string }
    reply: { regions: NoAssemblyRegion[] }
  }
  getSequence: {
    params: { region: Region }
    reply: { sequence: string }
  }
  getRefNameAliases: {
    params: { assembly: string }
    reply: { refNameAliases: RefNameAliases[] }
  }
}

export type MainThreadRequestMethod = keyof MainThreadRequests

/** The message the main thread sends back to the worker */
export type MainThreadReply = {
  apollo: true
  messageId: string
} & (
  | Partial<MainThreadRequests[MainThreadRequestMethod]['reply']>
  | { error: string }
)

/**
 * Whether this code is running in a web worker. Checked on each call rather
 * than once at module load, so tests can control it.
 */
export function isInWebWorker() {
  return 'WorkerGlobalScope' in globalThis
}

function isMainThreadReply(data: unknown): data is MainThreadReply {
  return (
    typeof data === 'object' &&
    data !== null &&
    'apollo' in data &&
    data.apollo === true &&
    'messageId' in data &&
    typeof data.messageId === 'string'
  )
}

/** Reply handlers for the pending requests, keyed by message ID */
function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason))
}

const pendingRequests = new Map<string, (reply: MainThreadReply) => void>()

/**
 * One listener handles the replies for every pending request. It's only
 * registered while at least one request is waiting.
 */
function handleReply(event: MessageEvent<unknown>) {
  const { data } = event
  if (!isMainThreadReply(data)) {
    return
  }
  pendingRequests.get(data.messageId)?.(data)
}

/**
 * Ask the main thread to run `method` and wait for its reply. Only call this
 * from a web worker.
 *
 * The request is cleaned up however it ends: a reply, an error reply, the
 * timeout, `signal` aborting, `stopToken` being stopped, or `rpcServer.emit`
 * throwing. Cancelling only stops the worker from waiting; the main thread
 * still finishes the request and its reply is ignored.
 */
export function requestFromMainThread<M extends MainThreadRequestMethod>(
  method: M,
  params: MainThreadRequests[M]['params'],
  { signal, stopToken }: MainThreadRequestOptions = {},
): Promise<MainThreadRequests[M]['reply']> {
  return new Promise((resolve, reject) => {
    try {
      signal?.throwIfAborted()
      checkStopToken(stopToken)
    } catch (error) {
      reject(toError(error))
      return
    }
    const messageId = nanoid()

    const settle = () => {
      clearTimeout(timeoutId)
      clearInterval(stopTokenIntervalId)
      signal?.removeEventListener('abort', onAbort)
      pendingRequests.delete(messageId)
      if (pendingRequests.size === 0) {
        removeEventListener('message', handleReply)
      }
    }
    const fail = (reason: unknown) => {
      settle()
      reject(toError(reason))
    }
    const onAbort = () => {
      fail(signal?.reason)
    }
    const timeoutId = setTimeout(() => {
      fail(new Error(`Timed out waiting for the main thread to ${method}`))
    }, MAIN_THREAD_REQUEST_TIMEOUT_MS)
    const stopTokenIntervalId =
      stopToken === undefined
        ? undefined
        : setInterval(() => {
            try {
              checkStopToken(stopToken)
            } catch (error) {
              fail(error)
            }
          }, STOP_TOKEN_CHECK_INTERVAL_MS)

    if (pendingRequests.size === 0) {
      addEventListener('message', handleReply)
    }
    pendingRequests.set(messageId, (reply) => {
      settle()
      if ('error' in reply) {
        reject(new Error(reply.error))
        return
      }
      resolve(reply as MainThreadRequests[M]['reply'])
    })
    signal?.addEventListener('abort', onAbort)

    try {
      rpcServer.emit('apollo', { apollo: true, method, messageId, ...params })
    } catch (error) {
      fail(error)
    }
  })
}
