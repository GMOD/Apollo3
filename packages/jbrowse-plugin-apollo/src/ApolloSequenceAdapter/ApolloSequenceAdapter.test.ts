import { getEventListeners } from 'node:events'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

import { ApolloSequenceAdapter } from './ApolloSequenceAdapter'
import configSchema from './configSchema'

const region = { assemblyName: 'asm', refName: 'ctgA', start: 0, end: 4 }
const regions = [{ refName: 'ctgA', start: 0, end: 100 }]
const savedGlobals = new Map<string, PropertyDescriptor | undefined>()
let messages: EventTarget
const emit = jest.fn<(event: string, message: { messageId: string }) => void>()
const removeListener = jest.fn<EventTarget['removeEventListener']>()

function replaceGlobal(name: string, value: unknown) {
  savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, value })
}

beforeEach(() => {
  jest.useFakeTimers()
  messages = new EventTarget()
  emit.mockClear()
  removeListener.mockReset()
  removeListener.mockImplementation((...args) => {
    messages.removeEventListener(...args)
  })
  replaceGlobal('addEventListener', messages.addEventListener.bind(messages))
  replaceGlobal('removeEventListener', removeListener)
  replaceGlobal('rpcServer', { emit })
})

afterEach(() => {
  jest.useRealTimers()
  for (const [name, descriptor] of savedGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, name)
    }
  }
  savedGlobals.clear()
})

function reply(messageId: string, data: object) {
  messages.dispatchEvent(
    new MessageEvent('message', { data: { apollo: true, messageId, ...data } }),
  )
}

describe.each(['getRegions', 'getFeatures'] as const)(
  '%s worker requests',
  (method) => {
    function request(adapter: ApolloSequenceAdapter) {
      return method === 'getRegions'
        ? adapter.getRegions()
        : new Promise((resolve, reject) => {
            adapter
              .getFeatures(region)
              .subscribe({ next: resolve, error: reject })
          })
    }

    it('removes the message listener when a request times out', async () => {
      const adapter = new ApolloSequenceAdapter(
        configSchema.create({ assemblyId: 'asm' }),
      )
      const response = request(adapter)
      expect(getEventListeners(messages, 'message')).toHaveLength(1)
      const rejected = expect(response).rejects.toBe('timeout')
      await jest.advanceTimersByTimeAsync(20_000)
      await rejected
      expect(getEventListeners(messages, 'message')).toHaveLength(0)
      expect(removeListener).toHaveBeenCalledTimes(1)
      expect(removeListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      )
      expect(jest.getTimerCount()).toBe(0)
    })

    it('ignores unrelated replies and cleans up after a matching reply', async () => {
      const adapter = new ApolloSequenceAdapter(
        configSchema.create({ assemblyId: 'asm' }),
      )
      const response = request(adapter)
      const [[, message]] = emit.mock.calls
      reply('other-request', { regions, sequence: 'ACGT' })
      expect(removeListener).not.toHaveBeenCalled()
      expect(jest.getTimerCount()).toBe(1)
      reply(message.messageId, { regions, sequence: 'ACGT' })
      const result = await response
      if (method === 'getRegions') {
        expect(result).toEqual(regions)
        expect(await adapter.getRegions()).toEqual(regions)
        expect(emit).toHaveBeenCalledTimes(1)
      } else {
        expect(result).toEqual(
          expect.objectContaining({
            data: expect.objectContaining({ seq: 'ACGT' }),
          }),
        )
      }
      expect(removeListener).toHaveBeenCalledTimes(1)
      expect(jest.getTimerCount()).toBe(0)
      await jest.advanceTimersByTimeAsync(20_000)
      expect(removeListener).toHaveBeenCalledTimes(1)
    })
  },
)
