import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

import RefNameAliasAdapter from '../ApolloRefNameAliasAdapter/ApolloRefNameAliasAdapter'
import refNameAliasConfigSchema from '../ApolloRefNameAliasAdapter/configSchema'
import { MAIN_THREAD_REQUEST_TIMEOUT_MS } from '../mainThreadRequest'
import {
  type MainThreadMessages,
  installWorkerGlobals,
  restoreWorkerGlobals,
} from '../testUtil/workerGlobals'

import { ApolloSequenceAdapter } from './ApolloSequenceAdapter'
import configSchema from './configSchema'

const region = { assemblyName: 'asm', refName: 'ctgA', start: 0, end: 4 }
const regions = [{ refName: 'ctgA', start: 0, end: 100 }]
let worker: MainThreadMessages

function makeAdapter() {
  return new ApolloSequenceAdapter(configSchema.create({ assemblyId: 'asm' }))
}

beforeEach(() => {
  jest.useFakeTimers()
  worker = installWorkerGlobals()
})

afterEach(() => {
  // Every test must leave no pending requests behind
  expect(worker.listenerCount()).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  jest.useRealTimers()
  restoreWorkerGlobals()
})

describe('ApolloSequenceAdapter in a worker', () => {
  it('sends one getRegions request for concurrent callers and caches it', async () => {
    const adapter = makeAdapter()
    const first = adapter.getRegions()
    const second = adapter.getRefNames()
    expect(worker.requests()).toHaveLength(1)
    worker.reply(worker.lastRequest().messageId, { regions })
    expect(await first).toEqual(regions)
    expect(await second).toEqual(['ctgA'])
    expect(await adapter.getRegions()).toEqual(regions)
    expect(worker.requests()).toHaveLength(1)
  })

  it('tries getRegions again after a timeout', async () => {
    const adapter = makeAdapter()
    const rejected = expect(adapter.getRegions()).rejects.toThrow('Timed out')
    await jest.advanceTimersByTimeAsync(MAIN_THREAD_REQUEST_TIMEOUT_MS)
    await rejected
    const retry = adapter.getRegions()
    expect(worker.requests()).toHaveLength(2)
    worker.reply(worker.lastRequest().messageId, { regions })
    expect(await retry).toEqual(regions)
  })

  it('returns the sequence from getFeatures', async () => {
    const response = new Promise((resolve, reject) => {
      makeAdapter()
        .getFeatures(region)
        .subscribe({ next: resolve, error: reject })
    })
    const request = worker.lastRequest()
    expect(request).toEqual(
      expect.objectContaining({ method: 'getSequence', region }),
    )
    worker.reply(request.messageId, { sequence: 'ACGT' })
    expect(await response).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ seq: 'ACGT' }),
      }),
    )
  })

  it('cleans up getFeatures when its signal aborts', async () => {
    const controller = new AbortController()
    const response = new Promise((resolve, reject) => {
      makeAdapter()
        .getFeatures(region, { signal: controller.signal })
        .subscribe({ next: resolve, error: reject })
    })
    expect(worker.listenerCount()).toBe(1)
    const reason = new Error('aborted')
    controller.abort(reason)
    await expect(response).rejects.toBe(reason)
  })
})

describe('ApolloRefNameAliasAdapter in a worker', () => {
  it('cleans up after a timeout and tries again on the next call', async () => {
    const adapter = new RefNameAliasAdapter(
      refNameAliasConfigSchema.create({ assemblyId: 'asm' }),
    )
    const rejected = expect(adapter.getRefNameAliases()).rejects.toThrow(
      'Timed out',
    )
    await jest.advanceTimersByTimeAsync(MAIN_THREAD_REQUEST_TIMEOUT_MS)
    await rejected
    expect(worker.listenerCount()).toBe(0)
    const retry = adapter.getRefNameAliases()
    const refNameAliases = [{ refName: 'ctgA', aliases: ['A'] }]
    worker.reply(worker.lastRequest().messageId, { refNameAliases })
    expect(await retry).toEqual(refNameAliases)
  })
})
