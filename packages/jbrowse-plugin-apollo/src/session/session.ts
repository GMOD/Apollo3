/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { Change, type SerializedChange } from '@apollo-annotation/common'
import {
  type AnnotationFeature,
  AnnotationFeatureModel,
} from '@apollo-annotation/mst'
import { type UserLocation, getDecodedToken } from '@apollo-annotation/shared'
import type PluginManager from '@jbrowse/core/PluginManager'
import type assemblyManager from '@jbrowse/core/assemblyManager'
import {
  type AnyConfigurationModel,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  type AbstractSessionModel,
  type SessionWithDrawerWidgets,
  isAbstractMenuManager,
  isElectron,
} from '@jbrowse/core/util'
import {
  type Instance,
  type SnapshotOut,
  addDisposer,
  applySnapshot,
  getRoot,
  getSnapshot,
  types,
} from '@jbrowse/mobx-state-tree'
import type { JobsListModel } from '@jbrowse/plugin-jobs-management'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import LockPersonIcon from '@mui/icons-material/LockPerson'
import { autorun, flow, observable, when } from 'mobx'

import { version as pluginVersion } from '../../package.json'
import { NoAccess } from '../components/NoAccess'
import type { ApolloPluginConfigModel } from '../config'
import { addTopLevelAdminMenus } from '../menus/topLevelMenuAdmin'
import type { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'

import { ChannelSubscriptions } from './ChannelSubscriptions'
import {
  type ClientDataStoreModel,
  clientDataStoreFactory,
} from './ClientDataStore'
import {
  type EventSourceHandlerContext,
  handleCommonMessage,
  handleRequestInformationMessage,
  handleUserLocationMessage,
} from './eventSourceHandlers'
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
  const ClientDataStore = clientDataStoreFactory()
  const sm = sessionModel
    .props({
      apolloDataStore: types.optional(ClientDataStore, { typeName: 'Client' }),
      apolloSelectedFeature: types.safeReference(AnnotationFeatureModel),
      isLocked: types.optional(types.boolean, false),
      changeInProgress: types.optional(types.boolean, false),
    })
    .volatile(() => ({
      apolloHoveredFeature: undefined as HoveredFeature | undefined,
      abortController: new AbortController(),
      lastChangeSequenceNumber: undefined as number | undefined,
      eventSource: undefined as EventSource | undefined,
      /** Per-refSeq change channels, see `CollaborationServerDriver` */
      channelSubscriptions: new ChannelSubscriptions(),
    }))
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

        let serializedChanges: SerializedChange[]
        try {
          const response: Response = yield fetch(uri, {
            method: 'GET',
            signal: self.abortController.signal,
          })
          if (!response.ok) {
            console.error(
              `Error when fetching the last updates to recover SSE connection — ${response.status}`,
            )
            return
          }
          ;({ changes: serializedChanges } = yield response.json())
        } catch (error) {
          // Reading the body can also be aborted, so it's inside the try too
          if (!self.abortController.signal.aborted) {
            console.error(error)
          }
          return
        }
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
        try {
          const response = await fetch(uri, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userLoc),
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
      addEventSourceListeners() {
        const { notify } = self as unknown as AbstractSessionModel
        const localSessionId = readConfObject(
          self.getPluginConfiguration(),
          'userSessionId',
        )
        const { addCheckResult, changeManager, deleteCheckResult } =
          self.apolloDataStore
        const context: EventSourceHandlerContext = {
          localSessionId,
          addCheckResult,
          deleteCheckResult,
          applyRemoteChange: (change) => {
            void changeManager.submit(change, { submitToBackend: false })
          },
          addOrUpdateCollaborator: (collaborator) => {
            self.addOrUpdateCollaborator(collaborator)
          },
          broadcastLocations: () => {
            self.broadcastLocations()
          },
        }

        // Same-origin, so the auth cookie authenticates the connection
        const url = new URL('messages/events', globalThis.location.href)
        const eventSource = new EventSource(url)
        self.eventSource = eventSource
        self.channelSubscriptions.attach(eventSource)

        eventSource.addEventListener('open', () => {
          // No baseline yet on the first connect, so there is nothing to be
          // missing: initializeCollaboration() is still fetching the sequence
          // number getMissingChanges() needs
          if (!self.lastChangeSequenceNumber) {
            return
          }
          void self.getMissingChanges()
        })
        eventSource.addEventListener('error', (error) => {
          console.error(error)
          notify('Could not connect to the Apollo server.', 'error')
        })
        eventSource.addEventListener('COMMON', (event) => {
          handleCommonMessage(JSON.parse(event.data), context)
        })
        eventSource.addEventListener('USER_LOCATION', (event) => {
          handleUserLocationMessage(JSON.parse(event.data), context)
        })
        eventSource.addEventListener('REQUEST_INFORMATION', (event) => {
          handleRequestInformationMessage(JSON.parse(event.data), context)
        })
      },
    }))
    .actions(() => ({
      /**
       * Ask the server for a token with the user's current role (which also
       * refreshes the auth cookie), and reload if an admin has given them access
       */
      async refreshAccess() {
        const uri = new URL('auth/refresh', globalThis.location.href).href
        const response = await fetch(uri, { method: 'POST' })
        if (!response.ok) {
          throw new Error(await createFetchErrorMessage(response))
        }
        const { token } = (await response.json()) as { token: string }
        const user = getDecodedToken(token)
        if (user.role && user.role !== 'none') {
          globalThis.location.reload()
        }
        return user
      },
      /** Log out and go to the login page, coming back here afterwards */
      switchAccount() {
        const loginURL = new URL('login', globalThis.location.href)
        loginURL.searchParams.set(
          'redirect_uri',
          globalThis.location.pathname + globalThis.location.search,
        )
        const logoutURL = new URL('logout', globalThis.location.href)
        logoutURL.searchParams.set(
          'redirect_uri',
          loginURL.pathname + loginURL.search,
        )
        globalThis.location.assign(logoutURL)
      },
    }))
    .actions((self) => ({
      async showNoAccess() {
        const session = self as unknown as AbstractSessionModel
        let username = ''
        let email = ''
        try {
          ;({ email, username } = await self.refreshAccess())
        } catch (error) {
          console.error(error)
        }
        session.queueDialog((doneCallback: () => void) => [
          NoAccess,
          {
            name: 'Apollo',
            username,
            email,
            handleCheckAgain: async () => {
              const { role } = await self.refreshAccess()
              return Boolean(role && role !== 'none')
            },
            handleSwitchAccount: () => {
              doneCallback()
              self.switchAccount()
            },
            handleClose: doneCallback,
          },
        ])
      },
      /**
       * Warns the user if this plugin and the server it talks to are not the
       * same version, since mismatched changes or endpoints can corrupt data or
       * fail in confusing ways
       */
      checkServerVersion: flow(function* checkServerVersion() {
        const uri = new URL('health/version', globalThis.location.href).href
        let serverVersion: string | undefined
        try {
          const response: Response = yield fetch(uri, {
            signal: self.abortController.signal,
          })
          if (response.ok) {
            ;({ version: serverVersion } = yield response.json())
          } else if (response.status !== 404) {
            // 404 means a server from before this endpoint existed, which is a
            // mismatch; anything else says nothing about the version
            console.error(
              yield createFetchErrorMessage(
                response,
                'Error when checking Apollo server version',
              ),
            )
            return
          }
        } catch (error) {
          if (!self.abortController.signal.aborted) {
            console.error(error)
          }
          return
        }
        if (serverVersion === pluginVersion) {
          return
        }
        ;(self as unknown as AbstractSessionModel).notify(
          `The Apollo server is ${
            serverVersion ? `version ${serverVersion}` : 'an older version'
          }, but this Apollo plugin is version ${pluginVersion}. Apollo may not work correctly until they match. Ask your administrator to update ${
            serverVersion ? 'one of them' : 'the server'
          }.`,
          'error',
        )
      }),
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
          void self.checkServerVersion()
          if (!self.hasCollaborationAccess) {
            void self.showNoAccess()
            const rootModel = getRoot(self)
            if (isAbstractMenuManager(rootModel)) {
              rootModel.appendToMenu('Apollo', {
                label: 'Check access',
                icon: LockPersonIcon,
                onClick: () => {
                  void self.showNoAccess()
                },
              })
            }
            return
          }
          if (self.apolloRole === 'admin') {
            const rootModel = getRoot(self)
            if (isAbstractMenuManager(rootModel)) {
              addTopLevelAdminMenus(rootModel)
            }
          }
          // Listen before fetching the sequence number, so no change made in
          // between is missed
          self.addEventSourceListeners()
          // Get and set server last change sequence into session storage
          yield self.updateLastChangeSequenceNumber()
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
        if (!self.hasCollaborationServer) {
          // Local sessions add their Apollo track config dynamically once
          // assemblies load (see the ApolloSessionLoadConfig reaction
          // below), so a session snapshot restored from a shared/saved URL
          // may reference that track before it exists, which JBrowse can't
          // resolve. Clear down to an empty snapshot now and restore the
          // real one once the track config exists. Collaboration-server
          // sessions don't need this: their Apollo tracks are already part
          // of the config the server serves.
          applySnapshot(self, { name: self.name, id: self.id })
        }
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
              const pluginConfiguration = self.getPluginConfiguration()
              const featureTypeOntologyName = readConfObject(
                pluginConfiguration,
                'featureTypeOntologyName',
              ) as string
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
              // Wait for assemblyManager to load before we do this part
              const { assemblies } = (self as unknown as AbstractSessionModel)
                .assemblyManager
              if (assemblies.length === 0) {
                return
              }
              if (!self.hasCollaborationServer) {
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
                for (const a of nonApolloAssemblies) {
                  self.addApolloLocalTrackConfig(a)
                }
                // Now that the track config exists, restore the snapshot
                // that was cleared in afterCreate so a previously open
                // Apollo track/view resolves correctly.
                applySnapshot(self, self.previousSnapshot)
              }
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
        self.eventSource?.close()
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
      // A change can't still be in progress in a restored session, and saving
      // this as true would block all edits in it
      snap.changeInProgress = false
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
