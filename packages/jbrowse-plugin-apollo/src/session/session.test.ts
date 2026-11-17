import type PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { type Instance, destroy, types } from '@jbrowse/mobx-state-tree'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

const postToServerA = jest.fn()
const postToServerB = jest.fn()

jest.unstable_mockModule('../ApolloJobModel', () => ({
  ApolloJobModel: types.model({}),
}))
const { extendSession } = await import('./session')

function assembly(internetAccountConfigId?: string) {
  return {
    configuration: {
      sequence: {
        metadata: internetAccountConfigId
          ? { apollo: true, internetAccountConfigId }
          : { apollo: true, file: 'local.fa' },
      },
    },
  }
}
const assemblies = new Map([
  ['remote', assembly('serverA')],
  ['remoteB', assembly('serverB')],
  ['local', assembly()],
])

const BaseSession = types
  .model({
    id: types.identifier,
    name: types.string,
    views: types.array(types.frozen()),
  })
  .volatile(() => ({
    // So that `getSession()` in ClientDataStore recognizes this as a session
    rpcManager: {},
    configuration: {},
    assemblyManager: {
      assemblies: [],
      get: (name: string) => assemblies.get(name),
    },
  }))
  .actions((self) => ({
    setViews(views: unknown[]) {
      self.views.replace(views)
    },
  }))
const Session = extendSession(
  {
    evaluateExtensionPoint: (_name: string, value: unknown) => value,
  } as PluginManager,
  BaseSession as never,
)
const pluginConfiguration = ConfigurationSchema('ApolloPlugin', {
  hasRole: { type: 'boolean', defaultValue: true },
  featureTypeOntologyName: {
    type: 'string',
    defaultValue: 'Sequence Ontology',
  },
})
const Root = types.model({ session: Session }).volatile(() => ({
  internetAccounts: [
    {
      type: 'ApolloInternetAccount',
      internetAccountId: 'serverA',
      postUserLocation: postToServerA,
    },
    {
      type: 'ApolloInternetAccount',
      internetAccountId: 'serverB',
      postUserLocation: postToServerB,
    },
  ],
  jbrowse: { configuration: { ApolloPlugin: pluginConfiguration.create() } },
}))
const linear = {
  type: 'LinearGenomeView',
  initialized: true,
  dynamicBlocks: {
    contentBlocks: [
      { assemblyName: 'remote', refName: 'ctgA', start: 10, end: 20 },
    ],
  },
}
const circular = { type: 'CircularView' }
const location = { assemblyId: 'remote', refSeq: 'ctgA', start: 10, end: 20 }
let root: ReturnType<typeof Root.create>
let session: Instance<typeof BaseSession> & { broadcastLocations(): void }
let savedLocation: PropertyDescriptor | undefined

beforeEach(() => {
  savedLocation = Object.getOwnPropertyDescriptor(globalThis, 'location')
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { href: 'http://localhost/' },
  })
  root = Root.create({
    session: { id: 'session', name: 'session', views: [] },
  } as never)
  session = root.session as unknown as typeof session
  postToServerA.mockClear()
  postToServerB.mockClear()
})

afterEach(() => {
  destroy(root)
  if (savedLocation) {
    Object.defineProperty(globalThis, 'location', savedLocation)
  } else {
    Reflect.deleteProperty(globalThis, 'location')
  }
})

describe.each([
  ['linear only', [linear]],
  ['circular before linear', [circular, linear]],
  ['circular after linear', [linear, circular]],
])('%s', (_name, views) => {
  it('broadcasts the linear location automatically', () => {
    session.setViews(views)
    expect(postToServerA).toHaveBeenLastCalledWith([location])
  })

  it('broadcasts the linear location explicitly', () => {
    session.setViews(views)
    postToServerA.mockClear()
    session.broadcastLocations()
    expect(postToServerA).toHaveBeenLastCalledWith([location])
  })
})

it('clears the previous location when only a circular view remains', () => {
  session.setViews([linear])
  postToServerA.mockClear()
  session.setViews([circular])
  expect(postToServerA).toHaveBeenLastCalledWith([])
  postToServerA.mockClear()
  session.broadcastLocations()
  expect(postToServerA).toHaveBeenLastCalledWith([])
})

it.each([
  ['uninitialized', { type: 'LinearGenomeView', initialized: false }],
  [
    'local assembly',
    {
      ...linear,
      dynamicBlocks: {
        contentBlocks: [
          { ...linear.dynamicBlocks.contentBlocks[0], assemblyName: 'local' },
        ],
      },
    },
  ],
  [
    'unknown assembly',
    {
      ...linear,
      dynamicBlocks: {
        contentBlocks: [
          { ...linear.dynamicBlocks.contentBlocks[0], assemblyName: 'unknown' },
        ],
      },
    },
  ],
])('omits %s locations', (_name, view) => {
  session.setViews([linear])
  postToServerA.mockClear()
  session.setViews([view])
  expect(postToServerA).toHaveBeenLastCalledWith([])
  postToServerA.mockClear()
  session.broadcastLocations()
  expect(postToServerA).toHaveBeenLastCalledWith([])
})

it('clears the previous location when all views close', () => {
  session.setViews([linear])
  postToServerA.mockClear()
  session.setViews([])
  expect(postToServerA).toHaveBeenLastCalledWith([])
  postToServerA.mockClear()
  session.broadcastLocations()
  expect(postToServerA).toHaveBeenLastCalledWith([])
})

function linearOn(assemblyName: string, refName = 'ctgA') {
  return {
    ...linear,
    dynamicBlocks: {
      contentBlocks: [{ assemblyName, refName, start: 10, end: 20 }],
    },
  }
}

it('sends each server only the locations on its own assemblies', () => {
  session.setViews([linearOn('remote'), linearOn('remoteB', 'ctgB')])
  expect(postToServerA).toHaveBeenLastCalledWith([location])
  expect(postToServerB).toHaveBeenLastCalledWith([
    { ...location, assemblyId: 'remoteB', refSeq: 'ctgB' },
  ])
  postToServerA.mockClear()
  postToServerB.mockClear()
  session.broadcastLocations()
  expect(postToServerA).toHaveBeenLastCalledWith([location])
  expect(postToServerB).toHaveBeenLastCalledWith([
    { ...location, assemblyId: 'remoteB', refSeq: 'ctgB' },
  ])
})

it("doesn't repost locations that haven't changed", () => {
  // The session already posted [] to both servers when it was created
  session.setViews([circular])
  session.setViews([circular, circular])
  expect(postToServerA).not.toHaveBeenCalled()
  expect(postToServerB).not.toHaveBeenCalled()
  session.setViews([linear])
  expect(postToServerA).toHaveBeenCalledTimes(1)
  expect(postToServerA).toHaveBeenLastCalledWith([location])
  // Server B's locations are still [], so it isn't posted to again
  expect(postToServerB).not.toHaveBeenCalled()
})

it('always posts when broadcasting explicitly', () => {
  session.setViews([circular])
  postToServerA.mockClear()
  session.broadcastLocations()
  expect(postToServerA).toHaveBeenLastCalledWith([])
})
