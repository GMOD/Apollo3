import { changeRegistry } from '@apollo-annotation/common'
import {
  type ChangeMessage,
  LocationEndChange,
} from '@apollo-annotation/shared'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

import { ChangeManager } from '../ChangeManager'
import type { ClientDataStoreModel } from '../session/ClientDataStore'
import { FakeEventSource, makeFakeToken } from '../test-utils/FakeEventSource'

import {
  type ApolloInternetAccount,
  CollaborationServerDriver,
} from './CollaborationServerDriver'

const localToken = makeFakeToken({ id: 'me', iat: 1000 })
const localSessionId = 'me-1000'
const otherSessionId = 'someoneElse-2000'

function makeChangeMessage(
  overrides: Partial<ChangeMessage> = {},
  featureId = 'feature1',
): ChangeMessage {
  return {
    channel: 'asm1-ctgA',
    userName: 'Someone Else',
    userSessionId: otherSessionId,
    changeSequence: 7,
    changeInfo: {
      typeName: 'LocationEndChange',
      assembly: 'asm1',
      changedIds: [featureId],
      featureId,
      oldEnd: 100,
      newEnd: 110,
    } as ChangeMessage['changeInfo'],
    ...overrides,
  }
}

/** Wait for the listener's async handler to finish */
function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('CollaborationServerDriver.checkEventSource', () => {
  let eventSource: FakeEventSource
  let internetAccount: ApolloInternetAccount
  let setLastChangeSequenceNumber: jest.Mock
  let driver: CollaborationServerDriver
  let submit: jest.SpiedFunction<ChangeManager['submit']>

  beforeAll(() => {
    try {
      changeRegistry.registerChange('LocationEndChange', LocationEndChange)
    } catch {
      // already registered
    }
  })

  beforeEach(() => {
    eventSource = new FakeEventSource('http://localhost/messages/events')
    setLastChangeSequenceNumber = jest.fn()
    internetAccount = {
      eventSource: eventSource as unknown as EventSource,
      retrieveToken: () => localToken,
      setLastChangeSequenceNumber,
    } as unknown as ApolloInternetAccount
    const clientStore = {
      assemblies: new Map([['asm1', {}]]),
      getFeature: (id: string) => (id === 'feature1' ? { _id: id } : undefined),
    } as unknown as ClientDataStoreModel
    driver = new CollaborationServerDriver(clientStore)
    submit = jest.spyOn(ChangeManager.prototype, 'submit').mockResolvedValue()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does nothing if the internet account has no event source', () => {
    const account = { ...internetAccount, eventSource: undefined }
    expect(() => {
      driver.checkEventSource('asm1', 'ctgA', account)
    }).not.toThrow()
  })

  it('listens on the "<assembly>-<refSeq>" channel', async () => {
    const addEventListener = jest.spyOn(eventSource, 'addEventListener')
    driver.checkEventSource('asm1', 'ctgA', internetAccount)
    expect(addEventListener).toHaveBeenCalledWith(
      'asm1-ctgA',
      expect.any(Function),
    )

    eventSource.emit('asm1-ctgA', makeChangeMessage())
    await flushPromises()
    expect(setLastChangeSequenceNumber).toHaveBeenCalledWith(7)
  })

  it('registers only one listener per channel', async () => {
    const addEventListener = jest.spyOn(eventSource, 'addEventListener')
    driver.checkEventSource('asm1', 'ctgA', internetAccount)
    driver.checkEventSource('asm1', 'ctgA', internetAccount)
    driver.checkEventSource('asm1', 'ctgB', internetAccount)
    expect(addEventListener).toHaveBeenCalledTimes(2)

    eventSource.emit('asm1-ctgA', makeChangeMessage())
    await flushPromises()
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('applies changes from other sessions without resubmitting them', async () => {
    driver.checkEventSource('asm1', 'ctgA', internetAccount)
    eventSource.emit('asm1-ctgA', makeChangeMessage())
    await flushPromises()
    expect(submit).toHaveBeenCalledTimes(1)
    const [[change, opts]] = submit.mock.calls
    expect(change).toBeInstanceOf(LocationEndChange)
    expect(change.toJSON()).toEqual(makeChangeMessage().changeInfo)
    expect(opts).toEqual({ submitToBackend: false })
  })

  it('does not reapply changes made in this session', async () => {
    driver.checkEventSource('asm1', 'ctgA', internetAccount)
    eventSource.emit(
      'asm1-ctgA',
      makeChangeMessage({ userSessionId: localSessionId, changeSequence: 8 }),
    )
    await flushPromises()
    expect(setLastChangeSequenceNumber).toHaveBeenCalledWith(8)
    expect(submit).not.toHaveBeenCalled()
  })

  it('ignores changes to features that are not loaded', async () => {
    driver.checkEventSource('asm1', 'ctgA', internetAccount)
    eventSource.emit('asm1-ctgA', makeChangeMessage({}, 'notLoaded'))
    await flushPromises()
    expect(setLastChangeSequenceNumber).toHaveBeenCalledWith(7)
    expect(submit).not.toHaveBeenCalled()
  })

  it('ignores events on channels it did not register', async () => {
    driver.checkEventSource('asm1', 'ctgA', internetAccount)
    eventSource.emit('asm1-ctgB', makeChangeMessage({ channel: 'asm1-ctgB' }))
    await flushPromises()
    expect(setLastChangeSequenceNumber).not.toHaveBeenCalled()
    expect(submit).not.toHaveBeenCalled()
  })
})
