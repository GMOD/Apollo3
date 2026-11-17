import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

import {
  MAIN_THREAD_REQUEST_TIMEOUT_MS,
  requestFromMainThread,
} from './mainThreadRequest'
import {
  type MainThreadMessages,
  installWorkerGlobals,
  restoreWorkerGlobals,
} from './testUtil/workerGlobals'

let worker: MainThreadMessages

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

describe('requestFromMainThread', () => {
  it('resolves with the matching reply and ignores other replies', async () => {
    const response = requestFromMainThread('getSequence', {
      region: { assemblyName: 'asm', refName: 'ctgA', start: 0, end: 4 },
    })
    const { messageId, method } = worker.lastRequest()
    expect(method).toBe('getSequence')
    worker.reply('other-request', { sequence: 'TTTT' })
    expect(worker.listenerCount()).toBe(1)
    worker.reply(messageId, { sequence: 'ACGT' })
    await expect(response).resolves.toEqual(
      expect.objectContaining({ sequence: 'ACGT' }),
    )
  })

  it('shares one message listener between concurrent requests', async () => {
    const first = requestFromMainThread('getRegions', { assembly: 'a' })
    const second = requestFromMainThread('getRegions', { assembly: 'b' })
    expect(worker.listenerCount()).toBe(1)
    const [firstRequest, secondRequest] = worker.requests()
    worker.reply(secondRequest.messageId, { regions: [] })
    await second
    expect(worker.listenerCount()).toBe(1)
    worker.reply(firstRequest.messageId, { regions: [] })
    await first
  })

  it('rejects with an Error and cleans up when the request times out', async () => {
    const response = requestFromMainThread('getRegions', { assembly: 'asm' })
    const rejected = expect(response).rejects.toThrow(
      'Timed out waiting for the main thread to getRegions',
    )
    await jest.advanceTimersByTimeAsync(MAIN_THREAD_REQUEST_TIMEOUT_MS)
    await rejected
  })

  it('rejects with the error the main thread replies with', async () => {
    const response = requestFromMainThread('getRegions', { assembly: 'asm' })
    worker.reply(worker.lastRequest().messageId, {
      error: 'No backend driver found',
    })
    await expect(response).rejects.toThrow('No backend driver found')
  })

  it('cleans up when the signal aborts', async () => {
    const controller = new AbortController()
    const response = requestFromMainThread(
      'getRegions',
      { assembly: 'asm' },
      { signal: controller.signal },
    )
    expect(worker.listenerCount()).toBe(1)
    const reason = new Error('aborted')
    controller.abort(reason)
    await expect(response).rejects.toBe(reason)
  })

  it("doesn't send a request when the signal has already aborted", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      requestFromMainThread(
        'getRegions',
        { assembly: 'asm' },
        { signal: controller.signal },
      ),
    ).rejects.toBeDefined()
    expect(worker.requests()).toHaveLength(0)
  })

  it('cleans up when sending the request throws', async () => {
    worker.emit.mockImplementationOnce(() => {
      throw new Error('worker not ready')
    })
    await expect(
      requestFromMainThread('getRegions', { assembly: 'asm' }),
    ).rejects.toThrow('worker not ready')
  })
})
