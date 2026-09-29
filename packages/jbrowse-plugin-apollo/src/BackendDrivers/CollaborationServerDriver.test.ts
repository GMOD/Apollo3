import { changeRegistry } from '@apollo-annotation/common'
import {
  type ChangeMessage,
  LocationEndChange,
} from '@apollo-annotation/shared'
import { types } from '@jbrowse/mobx-state-tree'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

import { ChannelSubscriptions } from '../ApolloInternetAccount/ChannelSubscriptions'
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
  let channelSubscriptions: ChannelSubscriptions
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
    channelSubscriptions = new ChannelSubscriptions()
    channelSubscriptions.attach(eventSource as unknown as EventSource)
    setLastChangeSequenceNumber = jest.fn()
    internetAccount = {
      channelSubscriptions,
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

  it('receives changes on channels registered before the event stream opens', async () => {
    const subscriptions = new ChannelSubscriptions()
    const account = { ...internetAccount, channelSubscriptions: subscriptions }
    driver.checkEventSource('asm1', 'ctgA', account)

    const laterEventSource = new FakeEventSource(
      'http://localhost/messages/events',
    )
    subscriptions.attach(laterEventSource as unknown as EventSource)
    laterEventSource.emit('asm1-ctgA', makeChangeMessage())
    await flushPromises()
    expect(setLastChangeSequenceNumber).toHaveBeenCalledWith(7)
    expect(submit).toHaveBeenCalledTimes(1)
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

const refSeqs = [
  {
    _id: 'refSeq1',
    name: 'ctgA',
    aliases: ['chrA', 'A'],
    length: '1000',
    assembly: 'asm1',
  },
]

// jest-fetch-mock's Response polyfill has no static Response.json()
function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  })
}

/** A fake Apollo server with one assembly, "asm1", and one refSeq, "ctgA" */
function fakeApolloFetch(input: RequestInfo | URL) {
  const url =
    typeof input === 'string'
      ? input
      : // eslint-disable-next-line unicorn/no-nested-ternary
        input instanceof URL
        ? input.href
        : input.url
  const { pathname } = new URL(url)
  if (pathname === '/refSeqs') {
    return Promise.resolve(jsonResponse(refSeqs))
  }
  if (pathname === '/features/getFeatures') {
    return Promise.resolve(jsonResponse([[], []]))
  }
  return Promise.resolve(new Response('Not found', { status: 404 }))
}

/**
 * The server broadcasts feature changes on `${assemblyId}-${refSeq.name}`,
 * using the refSeq's canonical name. These check that the driver subscribes
 * with the same name, and never with an alias.
 */
describe('CollaborationServerDriver channel names', () => {
  let channelSubscriptions: ChannelSubscriptions
  let subscribe: jest.SpiedFunction<ChannelSubscriptions['subscribe']>
  let driver: CollaborationServerDriver

  beforeEach(() => {
    channelSubscriptions = new ChannelSubscriptions()
    subscribe = jest.spyOn(channelSubscriptions, 'subscribe')
    const internetAccount = {
      baseURL: 'http://localhost/',
      channelSubscriptions,
      getFetcher() {
        return fakeApolloFetch
      },
    }
    // getSession() looks for an MST parent with these properties, so the
    // client store needs to be a node in a (minimal) session tree
    const ClientStore = types.model('ClientStore', {}).views(() => ({
      getInternetAccount: () => internetAccount,
    }))
    const Session = types
      .model('Session', { clientStore: ClientStore })
      .volatile(() => ({
        rpcManager: {},
        configuration: {},
        assemblyManager: {
          get: (name: string) => (name === 'asm1' ? {} : undefined),
        },
      }))
    const session = Session.create({ clientStore: {} })
    driver = new CollaborationServerDriver(
      session.clientStore as unknown as ClientDataStoreModel,
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('subscribes using the canonical refSeq name', async () => {
    await driver.getFeatures({
      assemblyName: 'asm1',
      refName: 'ctgA',
      start: 0,
      end: 100,
    })
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith('asm1-ctgA', expect.any(Function))
  })

  it.each(['chrA', 'A', 'refSeq1'])(
    'does not subscribe using the alias or ID "%s"',
    async (refName) => {
      await expect(
        driver.getFeatures({
          assemblyName: 'asm1',
          refName,
          start: 0,
          end: 100,
        }),
      ).rejects.toThrow(`Could not find refSeq "${refName}"`)
      expect(subscribe).not.toHaveBeenCalled()
    },
  )
})
