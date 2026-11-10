/**
 * Test helpers that make the jest global scope look like the web worker side
 * of Apollo's worker-to-main-thread requests.
 */
import { getEventListeners } from 'node:events'

import { jest } from '@jest/globals'

interface SentRequest {
  messageId: string
  method: string
  [key: string]: unknown
}

export interface MainThreadMessages {
  /** The event target that stands in for the worker's global scope */
  target: EventTarget
  /** Stands in for `rpcServer.emit`, which sends a request to the main thread */
  emit: jest.Mock<(event: string, request: SentRequest) => void>
  /** Every request sent to the main thread so far */
  requests(): SentRequest[]
  lastRequest(): SentRequest
  /** Send a reply from the main thread */
  reply(messageId: string, data: object): void
  /** How many 'message' listeners are registered */
  listenerCount(): number
}

const savedGlobals = new Map<string, PropertyDescriptor | undefined>()

function replaceGlobal(name: string, value: unknown) {
  if (!savedGlobals.has(name)) {
    savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  }
  Object.defineProperty(globalThis, name, { configurable: true, value })
}

/**
 * Set up worker globals: `WorkerGlobalScope` (so `isInWebWorker()` is true),
 * `addEventListener`/`removeEventListener` and `rpcServer`. Undo with
 * `restoreWorkerGlobals`.
 */
export function installWorkerGlobals(): MainThreadMessages {
  const target = new EventTarget()
  const emit = jest.fn<(event: string, request: SentRequest) => void>()
  // A real WorkerGlobalScope is an EventTarget; only its presence matters here
  replaceGlobal('WorkerGlobalScope', EventTarget)
  replaceGlobal('addEventListener', target.addEventListener.bind(target))
  replaceGlobal('removeEventListener', target.removeEventListener.bind(target))
  replaceGlobal('rpcServer', { emit })
  const requests = () => emit.mock.calls.map(([, request]) => request)
  return {
    target,
    emit,
    requests,
    lastRequest() {
      const request = requests().at(-1)
      if (!request) {
        throw new Error('No request has been sent')
      }
      return request
    },
    reply(messageId, data) {
      target.dispatchEvent(
        new MessageEvent('message', {
          data: { apollo: true, messageId, ...data },
        }),
      )
    },
    listenerCount() {
      return getEventListeners(target, 'message').length
    },
  }
}

export function restoreWorkerGlobals() {
  for (const [name, descriptor] of savedGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, name)
    }
  }
  savedGlobals.clear()
}
