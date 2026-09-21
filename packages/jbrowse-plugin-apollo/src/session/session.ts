/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { Change } from '@apollo-annotation/common'
import {
  type AnnotationFeature,
  AnnotationFeatureModel,
} from '@apollo-annotation/mst'
import type {
  ChangeMessage,
  CheckResultUpdate,
  RequestUserInformationMessage,
  UserLocation,
  UserLocationMessage,
} from '@apollo-annotation/shared'
import type PluginManager from '@jbrowse/core/PluginManager'
import type assemblyManager from '@jbrowse/core/assemblyManager'
import {
  type AnyConfigurationModel,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  isAbstractMenuManager,
  isElectron,
  type AbstractSessionModel,
  type SessionWithDrawerWidgets,
} from '@jbrowse/core/util'
import type { JobsListModel } from '@jbrowse/plugin-jobs-management'
import {
  type Instance,
  type SnapshotOut,
  addDisposer,
  applySnapshot,
  getRoot,
  getSnapshot,
  types,
} from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { autorun, flow, observable, when } from 'mobx'
import { io } from 'socket.io-client'

import type { ApolloPluginConfigModel } from '../config'
import { addTopLevelAdminMenus } from '../menus/topLevelMenuAdmin'
import type { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'

import {
  type ClientDataStoreModel,
  clientDataStoreFactory,
} from './ClientDataStore'
import { handleApolloFeaturesUrlParam } from './handleApolloFeaturesUrlParam'

interface JBrowseConfigWithTracks {
  addTrackConf(conf: {
    trackId: string
    type: string
    [key: string]: unknown
  }): unknown
}

export interface ApolloSession extends AbstractSessionModel {
  apolloDataStore: ClientDataStoreModel
  apolloSelectedFeature?: AnnotationFeature
  apolloSetSelectedFeature(feature?: AnnotationFeature): void
}

export interface Collaborator {
  name: string
  id: string
  locations: UserLocation[]
}

export interface HoveredFeature {
  feature: AnnotationFeature
  bp: number
}

type Assembly = Instance<ReturnType<typeof assemblyManager>>['assemblies'][0]

export function extendSession(
  pluginManager: PluginManager,
  sessionModel: ReturnType<typeof types.model>,
) {
  const AnnotationFeatureExtended = pluginManager.evaluateExtensionPoint(
    'Apollo-extendAnnotationFeature',
    AnnotationFeatureModel,
  ) as typeof AnnotationFeatureModel
  const ClientDataStore = clientDataStoreFactory(AnnotationFeatureExtended)
  const sm = sessionModel
    .props({
      apolloDataStore: types.optional(ClientDataStore, { typeName: 'Client' }),
      apolloSelectedFeature: types.safeReference(AnnotationFeatureExtended),
      isLocked: types.optional(types.boolean, false),
      changeInProgress: types.optional(types.boolean, false),
    })
    .volatile(() => ({
      apolloHoveredFeature: undefined as HoveredFeature | undefined,
      abortController: new AbortController(),
      lastChangeSequenceNumber: undefined as number | undefined,
      roleNotificationSent: false,
    }))
    .volatile(() => {
      const { origin, pathname } = new URL(
        'socket.io/',
        globalThis.location.href,
      )
      // autoConnect is disabled because a local-only session (no
      // collaboration server) has nothing to connect to; the socket is
      // connected explicitly in initializeCollaboration once we know a
      // server granted this session access.
      return { socket: io(origin, { path: pathname, autoConnect: false }) }
    })
    .extend(() => {
      const collabs = observable.array<Collaborator>([])

      return {
        views: {
          get collaborators() {
            return collabs
          },
        },
        actions: {
          addOrUpdateCollaborator(collaborator: Collaborator) {
            const existingCollaborator = collabs.find(
              (obj: Collaborator) => obj.id === collaborator.id,
            )
            if (existingCollaborator) {
              existingCollaborator.locations = collaborator.locations
            } else {
              collabs.push(collaborator)
            }
          },
        },
      }
    })
    .views((self) => ({
      get jobStatusWidget() {
        const { widgets } = self as unknown as SessionWithDrawerWidgets
        const jobStatusWidget =
          widgets.get('JobsList') ??
          // @ts-expect-error: addWidget function not detected on the session
          self.addWidget('JobsListWidget', 'JobsList')
        return jobStatusWidget as unknown as JobsListModel
      },
    }))
    .actions((self) => ({
      showJobStatusWidget() {
        ;(self as unknown as SessionWithDrawerWidgets).showWidget(
          self.jobStatusWidget,
        )
      },
      apolloSetSelectedFeature(feature?: AnnotationFeature | string) {
        // @ts-expect-error Not sure why TS thinks these MST types don't match
        self.apolloSelectedFeature = feature
      },
      apolloSetHoveredFeature(feature?: HoveredFeature) {
        self.apolloHoveredFeature = feature
      },
      addApolloLocalTrackConfig(assembly: Assembly) {
        const trackId = `apollo_track_${assembly.name}`
        const hasTrack = (self as unknown as AbstractSessionModel).tracks.some(
          (track) => track.trackId === trackId,
        )
        if (!hasTrack) {
          ;(
            getRoot<ApolloRootModel>(self).jbrowse as JBrowseConfigWithTracks
          ).addTrackConf({
            type: 'ApolloTrack',
            trackId,
            name: `Annotations (${assembly.displayName})`,
            assemblyNames: [assembly.name],
            category: ['Apollo'],
          })
        }
      },
      toggleLocked() {
        self.isLocked = !self.isLocked
      },
      setChangeInProgress(changeInProgress: boolean) {
        self.changeInProgress = changeInProgress
      },
      getPluginConfiguration() {
        const { jbrowse } = getRoot<ApolloRootModel>(self)
        const pluginConfiguration =
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          jbrowse.configuration.ApolloPlugin as ApolloPluginConfigModel
        return pluginConfiguration
      },
    }))
    .views((self) => ({
      // `hasRole` is set by the collaboration server for every config it
      // serves, whether or not the logged-in user was granted a role — it's
      // false only when there is no collaboration server at all (e.g. a
      // bare local config.json), which is how we tell a local-only session
      // apart from one where the server denied access.
      get hasCollaborationServer() {
        return readConfObject(self.getPluginConfiguration(), 'hasRole') as
          | boolean
          | undefined
      },
      get apolloRole() {
        return readConfObject(self.getPluginConfiguration(), 'role') as
          | string
          | undefined
      },
      get hasCollaborationAccess(): boolean {
        return Boolean(
          self.hasCollaborationServer &&
            self.apolloRole &&
            self.apolloRole !== 'none',
        )
      },
    }))
    .actions((self) => ({
      setLastChangeSequenceNumber(sequenceNumber: number) {
        self.lastChangeSequenceNumber = sequenceNumber
      },
    }))
    .actions((self) => ({
      updateLastChangeSequenceNumber: flow(
        function* updateLastChangeSequenceNumber() {
          const url = new URL('changes', globalThis.location.href)
          url.search = new URLSearchParams({ limit: '1' }).toString()
          const uri = url.toString()

          let response: Response
          try {
            response = yield fetch(uri, {
              method: 'GET',
              signal: self.abortController.signal,
            })
          } catch (error) {
            if (!self.abortController.signal.aborted) {
              console.error(error)
            }
            return
          }
          if (!response.ok) {
            const errorMessage = yield createFetchErrorMessage(
              response,
              'Error when fetching server LastChangeSequence',
            )
            throw new Error(errorMessage)
          }
          const { changes } = yield response.json()
          const sequence = changes.length > 0 ? changes[0].sequence : 0
          self.setLastChangeSequenceNumber(sequence)
        },
      ),
      getMissingChanges: flow(function* getMissingChanges() {
        const { changeManager } = self.apolloDataStore
        if (!self.lastChangeSequenceNumber) {
          throw new Error(
            'No LastChangeSequence stored in session. Please, refresh you browser to get last updates from server',
          )
        }
        const url = new URL('changes', globalThis.location.href)
        url.search = new URLSearchParams({
          since: String(self.lastChangeSequenceNumber),
          sort: '1',
        }).toString()
        const uri = url.toString()

        let response: Response
        try {
          response = yield fetch(uri, {
            method: 'GET',
            signal: self.abortController.signal,
          })
        } catch (error) {
          if (!self.abortController.signal.aborted) {
            console.error(error)
          }
          return
        }
        if (!response.ok) {
          console.error(
            `Error when fetching the last updates to recover socket connection — ${response.status}`,
          )
          return
        }
        const { changes: serializedChanges } = yield response.json()
        for (const serializedChange of serializedChanges) {
          const change = Change.fromJSON(serializedChange)
          void changeManager.submit(change, { submitToBackend: false })
        }
      }),
    }))
    .actions((self) => {
      async function postUserLocation(userLoc: UserLocation[]) {
        if (!self.hasCollaborationAccess) {
          return
        }
        const uri = new URL('users/userLocation', globalThis.location.href).href
        const userLocation = new URLSearchParams(JSON.stringify(userLoc))
        try {
          const response = await fetch(uri, {
            method: 'POST',
            body: userLocation,
            signal: self.abortController.signal,
          })
          if (!response.ok) {
            throw new Error('ignore') // ignore message, will get caught by "catch"
          }
        } catch {
          console.error('Broadcasting user location failed')
        }
      }
      const debounceTimeout = 300
      const debouncePostUserLocation = (
        fn: (userLocation: UserLocation[]) => void,
      ) => {
        let timeoutId: ReturnType<typeof setTimeout>
        return (userLocation: UserLocation[]) => {
          clearTimeout(timeoutId)
          timeoutId = setTimeout(() => {
            fn(userLocation)
          }, debounceTimeout)
        }
      }
      return { postUserLocation: debouncePostUserLocation(postUserLocation) }
    })
    .actions((self) => ({
      broadcastLocations() {
        if (!self.hasCollaborationAccess) {
          return
        }
        const locations: {
          assemblyName: string
          refName: string
          start: number
          end: number
        }[] = []
        for (const view of (self as unknown as AbstractSessionModel).views) {
          if (view.type !== 'LinearGenomeView') {
            return
          }
          const lgv = view as unknown as LinearGenomeViewModel
          if (lgv.initialized) {
            const { dynamicBlocks } = lgv
            for (const block of dynamicBlocks.contentBlocks) {
              const { assemblyName, end, refName, start } = block
              const assembly =
                self.apolloDataStore.getAssemblyByName(assemblyName)
              if (assembly?.backendDriverType === 'CollaborationServerDriver') {
                locations.push({ assemblyName, refName, start, end })
              }
            }
          }
        }
        if (locations.length === 0) {
          self.postUserLocation([])
          return
        }

        const allLocations: UserLocation[] = locations.map((location) => ({
          assemblyId: location.assemblyName,
          refSeq: location.refName,
          start: location.start,
          end: location.end,
        }))
        self.postUserLocation(allLocations)
      },
    }))
    .actions((self) => ({
      addSocketListeners() {
        const { notify } = self as unknown as AbstractSessionModel
        const localSessionId = readConfObject(
          self.getPluginConfiguration(),
          'userSessionId',
        ) as string
        const { socket } = self
        const { addCheckResult, changeManager, deleteCheckResult } =
          self.apolloDataStore
        socket.on('connect', () => {
          void self.getMissingChanges()
        })
        socket.on('connect_error', (error) => {
          console.error(error)
          notify('Could not connect to the Apollo server.', 'error')
        })
        socket.on('COMMON', (message: ChangeMessage | CheckResultUpdate) => {
          if ('checkResult' in message) {
            if (message.deleted) {
              deleteCheckResult(message.checkResult._id)
            } else {
              addCheckResult(message.checkResult)
            }
            return
          }
          // Save server last change sequence into session storage
          sessionStorage.setItem(
            'LastChangeSequence',
            String(message.changeSequence),
          )
          if (message.userSessionId === localSessionId) {
            return // we did this change, no need to apply it again
          }
          const change = Change.fromJSON(message.changeInfo)
          void changeManager.submit(change, { submitToBackend: false })
        })
        socket.on('USER_LOCATION', (message: UserLocationMessage) => {
          const { channel, locations, userName, userSessionId } = message
          if (channel === 'USER_LOCATION' && userSessionId !== localSessionId) {
            const collaborator: Collaborator = {
              name: userName,
              id: userSessionId,
              locations,
            }
            self.addOrUpdateCollaborator(collaborator)
          }
        })
        socket.on(
          'REQUEST_INFORMATION',
          (message: RequestUserInformationMessage) => {
            const { channel, userSessionId } = message
            if (
              channel === 'REQUEST_INFORMATION' &&
              userSessionId !== localSessionId
            ) {
              self.broadcastLocations()
            }
          },
        )
      },
    }))
    .actions((self) => {
      function beforeUnloadListener() {
        self.postUserLocation([])
      }
      function visibilityChangeListener() {
        // fires when user switches tabs, apps, goes to homescreen, etc.
        if (document.visibilityState === 'hidden') {
          self.postUserLocation([])
        }
        // fires when app transitions from prerender, user returns to the app / tab.
        if (document.visibilityState === 'visible') {
          self.broadcastLocations()
        }
      }
      return {
        initializeCollaboration: flow(function* initializeCollaboration() {
          if (!self.hasCollaborationServer) {
            // Local-only session (e.g. a bare config.json with no
            // collaboration server behind it) — there is nothing to
            // connect to or request access from.
            return
          }
          if (!self.hasCollaborationAccess) {
            if (!self.roleNotificationSent) {
              ;(self as unknown as AbstractSessionModel).notify(
                'You have registered as an Apollo user but have not been given access. Ask your administrator to enable access for your account.',
                'warning',
              )
              self.roleNotificationSent = true
            }
            return
          }
          if (self.apolloRole === 'admin') {
            const rootModel = getRoot(self)
            if (isAbstractMenuManager(rootModel)) {
              addTopLevelAdminMenus(rootModel)
            }
          }
          // Get and set server last change sequence into session storage
          yield self.updateLastChangeSequenceNumber()
          // Connect to the collaboration server and open socket listeners
          self.socket.connect()
          self.addSocketListeners()
          // request user locations
          const uri = new URL('users/locations', globalThis.location.href).href
          try {
            yield fetch(uri, {
              method: 'GET',
              signal: self.abortController.signal,
            })
          } catch (error) {
            if (!self.abortController.signal.aborted) {
              console.error(error)
            }
          }
          globalThis.addEventListener('beforeunload', beforeUnloadListener)
          document.addEventListener(
            'visibilitychange',
            visibilityChangeListener,
          )
        }),
        removeBeforeUnloadListener() {
          globalThis.removeEventListener('beforeunload', beforeUnloadListener)
        },
        removeVisibilityChangeListener() {
          document.removeEventListener(
            'visibilitychange',
            visibilityChangeListener,
          )
        },
      }
    })
    .actions((self) => ({
      apolloSetEventualSelectedFeature: flow(
        function* apolloSetEventualSelectedFeature(featureId: string) {
          yield when(() => Boolean(self.apolloDataStore.getFeature(featureId)))
          self.apolloSetSelectedFeature(featureId)
        },
      ),
    }))
    .volatile((self) => ({
      previousSnapshot: getSnapshot(self),
    }))
    .actions((self) => ({
      afterCreate() {
        applySnapshot(self, { name: self.name, id: self.id })
        void self.initializeCollaboration()
        addDisposer(
          self,
          autorun(
            () => {
              // broadcastLocations() // **** This is not working and therefore we need to duplicate broadcastLocations() -method code here because autorun() does not observe changes otherwise
              if (!self.hasCollaborationAccess) {
                // Local-only session, or one without a granted role — there
                // is no collaboration server to broadcast locations to.
                return
              }
              const locations: {
                assemblyName: string
                refName: string
                start: number
                end: number
              }[] = []
              for (const view of (self as unknown as AbstractSessionModel)
                .views) {
                if (view.type !== 'LinearGenomeView') {
                  return
                }
                const lgv = view as unknown as LinearGenomeViewModel
                if (lgv.initialized) {
                  const { dynamicBlocks } = lgv
                  for (const block of dynamicBlocks.contentBlocks) {
                    const { assemblyName, end, refName, start } = block
                    const assembly =
                      self.apolloDataStore.getAssemblyByName(assemblyName)
                    if (
                      assembly?.backendDriverType ===
                      'CollaborationServerDriver'
                    ) {
                      locations.push({ assemblyName, refName, start, end })
                    }
                  }
                }
              }
              if (locations.length === 0) {
                self.postUserLocation([])
                return
              }

              const allLocations: UserLocation[] = locations.map(
                (location) => ({
                  assemblyId: location.assemblyName,
                  refSeq: location.refName,
                  start: location.start,
                  end: location.end,
                }),
              )
              self.postUserLocation(allLocations)
            },
            { name: 'ApolloSessionBroadcastLocations' },
          ),
        )
        addDisposer(
          self,
          autorun(
            (reaction) => {
              // When the initial config.json loads, it doesn't include the Apollo
              // tracks, which would result in a potentially invalid session snapshot
              // if any tracks are open. Here we copy the session snapshot, apply an
              // empty session snapshot, and then restore the original session
              // snapshot after the updated config.json loads.
              if (!self.hasCollaborationServer) {
                // Local-only session — there is no server-driven config
                // update to wait for, so skip this reaction entirely
                // (and avoid subscribing to assembly changes for nothing).
                return
              }
              const pluginConfiguration = self.getPluginConfiguration()
              const featureTypeOntologyName = readConfObject(
                pluginConfiguration,
                'featureTypeOntologyName',
              ) as string
              const nonApolloAssemblies = (
                self as unknown as AbstractSessionModel
              ).assemblyManager.assemblies.filter(
                (a) =>
                  !(
                    getConf(a, ['sequence', 'metadata']) as {
                      apollo?: boolean
                    }
                  ).apollo,
              )
              // Wait for assemblyManager to load before we do this part
              const { assemblies } = (self as unknown as AbstractSessionModel)
                .assemblyManager
              if (assemblies.length === 0) {
                return
              }
              const { pluginConfiguration: dataStorePluginConfiguration } =
                self.apolloDataStore
              const configuredOntologies =
                dataStorePluginConfiguration.ontologies as AnyConfigurationModel[]
              const featureTypeOntology = configuredOntologies.find(
                (ont) =>
                  readConfObject(ont, 'name') === featureTypeOntologyName,
              )
              if (!featureTypeOntology) {
                dataStorePluginConfiguration.addOntology({
                  name: 'Sequence Ontology',
                  version: '01c33c6d9b6c8dca12e7d3e37b49ee113093c2fa',
                  source: {
                    uri: 'https://raw.githubusercontent.com/The-Sequence-Ontology/SO-Ontologies/01c33c6d9b6c8dca12e7d3e37b49ee113093c2fa/Ontology_Files/so.json',
                    locationType: 'UriLocation',
                  },
                })
              }
              for (const a of nonApolloAssemblies) {
                self.addApolloLocalTrackConfig(a)
              }
              applySnapshot(self, self.previousSnapshot)
              reaction.dispose()
            },
            { name: 'ApolloSessionLoadConfig' },
          ),
        )
      },
      beforeDestroy() {
        self.removeBeforeUnloadListener()
        self.removeVisibilityChangeListener()
        self.abortController.abort(
          new DOMException('Clean up Apollo session', 'AbortError'),
        )
        self.socket.close()
      },
    }))
    .actions((self) => ({
      async afterCreate() {
        if (isElectron) {
          return
        }
        const url = new URL(globalThis.location.href)
        const apolloFeatures = url.searchParams.get('apolloFeatures')
        if (!apolloFeatures) {
          return
        }
        const { assemblyManager } = self as unknown as AbstractSessionModel
        await handleApolloFeaturesUrlParam(
          apolloFeatures,
          self.apolloDataStore,
          assemblyManager,
          self as unknown as AbstractSessionModel,
        )
        await new Promise((resolve) => setTimeout(resolve, 2000))
        const updatedURL = new URL(globalThis.location.href)
        updatedURL.searchParams.delete('apolloFeatures')
        globalThis.history.replaceState(null, '', updatedURL.toString())
      },
      afterAttach() {
        addDisposer(
          self,
          autorun((reaction) => {
            const { focusedViewId, activeWidgets } =
              self as unknown as SessionWithDrawerWidgets
            if (!(focusedViewId && activeWidgets)) {
              return
            }
            const trackSelector = activeWidgets.get('hierarchicalTrackSelector')
            // @ts-expect-error Don't have type for track selector
            trackSelector?.setView(focusedViewId)
            reaction.dispose()
          }),
        )
      },
    }))

  return types.snapshotProcessor(sm, {
    postProcessor(snap: SnapshotOut<typeof sm>, node) {
      snap.apolloSelectedFeature = undefined
      // @ts-expect-error ontologyManager isn't actually required
      snap.apolloDataStore = {
        typeName: 'Client',
        checkResults: {},
      }
      if (!node) {
        return snap
      }
      const { apolloDataStore } = node
      const { checkResults } = apolloDataStore
      for (const [, cr] of checkResults) {
        const [feature] = cr.ids
        if (!feature) {
          continue
        }
      }
      return snap
    },
  })
}

export type ApolloSessionStateModel = ReturnType<typeof extendSession>
// @ts-expect-error Snapshots seem to mess up types here
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloSessionModel extends Instance<ApolloSessionStateModel> {}
