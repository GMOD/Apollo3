import type PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  type Instance,
  applySnapshot,
  destroy,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

const postUserLocation = jest.fn()
const Assembly = types.model({ backendDriverType: types.string })

const ClientDataStore = types.model({
  typeName: types.optional(types.string, 'Client'),
  assemblies: types.map(Assembly),
  checkResults: types.map(types.frozen()),
})
jest.unstable_mockModule('./ClientDataStore', () => ({
  clientDataStoreFactory: () => ClientDataStore,
}))
jest.unstable_mockModule('../ApolloJobModel', () => ({
  ApolloJobModel: types.model({}),
}))
const { extendSession } = await import('./session')

const BaseSession = types
  .model({
    id: types.identifier,
    name: types.string,
    views: types.array(types.frozen()),
  })
  .volatile(() => ({ assemblyManager: { assemblies: [] } }))
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
  internetAccounts: [{ type: 'ApolloInternetAccount', postUserLocation }],
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
let session: Instance<typeof BaseSession> & {
  apolloDataStore: Instance<typeof ClientDataStore>
  broadcastLocations(): void
}
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
  applySnapshot(session.apolloDataStore, {
    typeName: 'Client',
    checkResults: {},
    assemblies: {
      remote: { backendDriverType: 'CollaborationServerDriver' },
      local: { backendDriverType: 'LocalDriver' },
    },
  })
  postUserLocation.mockClear()
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
    expect(postUserLocation).toHaveBeenLastCalledWith([location])
  })

  it('broadcasts the linear location explicitly', () => {
    session.setViews(views)
    postUserLocation.mockClear()
    session.broadcastLocations()
    expect(postUserLocation).toHaveBeenLastCalledWith([location])
  })
})

it('clears the previous location when only a circular view remains', () => {
  session.setViews([linear])
  postUserLocation.mockClear()
  session.setViews([circular])
  expect(postUserLocation).toHaveBeenLastCalledWith([])
  postUserLocation.mockClear()
  session.broadcastLocations()
  expect(postUserLocation).toHaveBeenLastCalledWith([])
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
  session.setViews([view])
  expect(postUserLocation).toHaveBeenLastCalledWith([])
  postUserLocation.mockClear()
  session.broadcastLocations()
  expect(postUserLocation).toHaveBeenLastCalledWith([])
})

it('clears the previous location when all views close', () => {
  session.setViews([linear])
  postUserLocation.mockClear()
  session.setViews([])
  expect(postUserLocation).toHaveBeenLastCalledWith([])
  postUserLocation.mockClear()
  session.broadcastLocations()
  expect(postUserLocation).toHaveBeenLastCalledWith([])
})
