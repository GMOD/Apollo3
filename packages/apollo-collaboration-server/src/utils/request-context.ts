import { AsyncLocalStorage } from 'node:async_hooks'

interface RequestContext {
  correlationId: string
}

/**
 * Holds per-request (HTTP) or per-connection (WebSocket) context so that log
 * lines emitted anywhere in the call chain can be tied back to their origin.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>()

export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.correlationId
}

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return requestContext.run({ correlationId }, fn)
}
