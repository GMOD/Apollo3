/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, unicorn/consistent-function-scoping */
import {
  type AnnotationFeature,
  AnnotationFeatureModel,
} from '@apollo-annotation/mst'
import {
  ImportJBrowseConfigChange,
  type JBrowseConfig,
  type UserLocation,
  filterJBrowseConfig,
  getDecodedToken,
} from '@apollo-annotation/shared'
import type PluginManager from '@jbrowse/core/PluginManager'
import type assemblyManager from '@jbrowse/core/assemblyManager'
import {
  type AnyConfigurationModel,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type {
  AbstractSessionModel,
  SessionWithAddTracks,
} from '@jbrowse/core/util'
import {
  type Instance,
  type SnapshotOut,
  addDisposer,
  applySnapshot,
  getRoot,
  getSnapshot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import SaveIcon from '@mui/icons-material/Save'
import { autorun, flow, observable, when } from 'mobx'

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloJobModel } from '../ApolloJobModel'
import type ApolloPluginConfigurationSchema from '../config'
import { type ApolloRootModel, isApolloInternetAccount } from '../types'
import { createFetchErrorMessage } from '../util'

import {
  type ClientDataStoreModel,
  clientDataStoreFactory,
} from './ClientDataStore'

function safeRetrieveToken(account: ApolloInternetAccountModel) {
  try {
    if (!isAlive(account)) {
      return
    }
    return account.retrieveToken() ?? undefined
  } catch {
    return
  }
}

function getApolloInternetAccounts(
  internetAccounts: ApolloRootModel['internetAccounts'],
) {
  return internetAccounts.filter(
    (internetAccount): internetAccount is ApolloInternetAccountModel =>
      isApolloInternetAccount(internetAccount),
  )
}

function asAbstractSessionModel(model: unknown) {
  return model as AbstractSessionModel
}

function asLinearGenomeViewModel(view: unknown) {
  return view as LinearGenomeViewModel
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

interface AssemblyPermissionResponse {
  assemblyId?: string
  assembly?: string
  canViewAnnotations: boolean
  canEditAnnotations: boolean
}

interface AssemblyResponse {
  _id: string
  name: string
}

export function extendSession(
  pluginManager: PluginManager,
  sessionModel: ReturnType<typeof types.model>,
) {
  const normalizeConfigAssemblyNames = (config: JBrowseConfig) => {
    interface ConfigAssembly {
      name: string
      displayName?: string
    }
    interface ConfigTrack {
      assemblyNames?: string[]
      [key: string]: unknown
    }

    const assemblies = (config.assemblies ?? []) as unknown as ConfigAssembly[]
    const displayNameToAssemblyName = new Map<string, string>()
    for (const assembly of assemblies) {
      if (assembly.displayName && assembly.displayName !== assembly.name) {
        displayNameToAssemblyName.set(assembly.displayName, assembly.name)
      }
    }

    const tracks = (config.tracks ?? []) as unknown as ConfigTrack[]
    if (displayNameToAssemblyName.size === 0 || tracks.length === 0) {
      return config
    }

    const normalizedTracks = tracks.map((track: ConfigTrack) => {
      if (!track.assemblyNames?.length) {
        return track
      }
      const normalizedAssemblyNames = track.assemblyNames.map(
        (assemblyName: string) =>
          displayNameToAssemblyName.get(assemblyName) ?? assemblyName,
      )
      return {
        ...track,
        assemblyNames: normalizedAssemblyNames,
      }
    })

    return {
      ...config,
      tracks: normalizedTracks,
    }
  }

  const isGuestToken = (token: string) => {
    try {
      const { username, email } = getDecodedToken(token)
      return (
        username?.toLowerCase() === 'guest' ||
        email?.toLowerCase() === 'guest_user'
      )
    } catch {
      return false
    }
  }

  const removeApolloTracksFromSession = (session: AbstractSessionModel) => {
    const sessionWithDelete = session as AbstractSessionModel & {
      deleteTrackConf?: (conf: BaseTrackConfig) => void
    }
    const jbrowseWithDelete = getRoot<ApolloRootModel>(
      session as unknown as ApolloSessionModel,
    ).jbrowse as {
      tracks?: BaseTrackConfig[]
      deleteTrackConf?: (conf: BaseTrackConfig) => void
    }

    const apolloTracks = new Map<string, BaseTrackConfig>()
    const collectApolloTracks = (trackList?: BaseTrackConfig[]) => {
      for (const track of trackList ?? []) {
        const trackType = (track as unknown as { type?: string }).type
        const trackId = readConfObject(track, 'trackId') as string | undefined
        if (
          trackType === 'ApolloTrack' ||
          trackId?.startsWith('apollo_track_')
        ) {
          apolloTracks.set(trackId ?? String(apolloTracks.size), track)
        }
      }
    }

    collectApolloTracks([...session.tracks])
    collectApolloTracks(jbrowseWithDelete.tracks)

    for (const track of apolloTracks.values()) {
      sessionWithDelete.deleteTrackConf?.(track)
      jbrowseWithDelete.deleteTrackConf?.(track)
    }
  }

  const getViewableAssemblyNamesForAccount = async (
    internetAccount: ApolloInternetAccountModel,
    signal: AbortSignal,
  ) => {
    const { baseURL } = internetAccount
    const assembliesUri = new URL('assemblies', baseURL).href
    const permissionsUri = new URL('assemblyPermissions/mine', baseURL).href
    const apolloFetch = internetAccount.getFetcher({
      locationType: 'UriLocation',
      uri: permissionsUri,
    })

    const [assembliesResponse, permissionsResponse] = await Promise.all([
      apolloFetch(assembliesUri, { method: 'GET', signal }),
      apolloFetch(permissionsUri, { method: 'GET', signal }),
    ])

    if (!assembliesResponse.ok || !permissionsResponse.ok) {
      return new Set<string>()
    }

    const assemblies = (await assembliesResponse.json()) as AssemblyResponse[]
    const permissions =
      (await permissionsResponse.json()) as AssemblyPermissionResponse[]
    const assemblyIdToName = new Map(
      assemblies.map((assembly) => [assembly._id, assembly.name]),
    )

    return new Set(
      permissions
        .filter(
          (permission) =>
            permission.canViewAnnotations || permission.canEditAnnotations,
        )
        .map((permission) =>
          assemblyIdToName.get(
            permission.assemblyId ?? permission.assembly ?? '',
          ),
        )
        .filter(Boolean),
    )
  }

  const AnnotationFeatureExtended = pluginManager.evaluateExtensionPoint(
    'Apollo-extendAnnotationFeature',
    AnnotationFeatureModel,
  ) as typeof AnnotationFeatureModel
  const ClientDataStore = clientDataStoreFactory(AnnotationFeatureExtended)
  const sm = sessionModel
    .props({
      apolloDataStore: types.optional(ClientDataStore, { typeName: 'Client' }),
      apolloSelectedFeature: types.safeReference(AnnotationFeatureExtended),
      jobsManager: types.optional(ApolloJobModel, {}),
      isLocked: types.optional(types.boolean, false),
      changeInProgress: types.optional(types.boolean, false),
    })
    .volatile(() => ({
      apolloHoveredFeature: undefined as HoveredFeature | undefined,
      abortController: new AbortController(),
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
    .actions((self) => ({
      apolloSetSelectedFeature(feature?: AnnotationFeature | string) {
        // @ts-expect-error Not sure why TS thinks these MST types don't match
        self.apolloSelectedFeature = feature
      },
      apolloSetHoveredFeature(feature?: HoveredFeature) {
        self.apolloHoveredFeature = feature
      },
      addApolloLocalTrackConfig(assembly: Assembly) {
        const trackId = `apollo_track_${assembly.name}`
        const hasTrack = asAbstractSessionModel(self).tracks.some(
          (track) => track.trackId === trackId,
        )
        if (!hasTrack) {
          ;(
            getRoot<ApolloRootModel>(self).jbrowse as {
              addTrackConf: SessionWithAddTracks['addTrackConf']
            }
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
        const pluginConfiguration = jbrowse.configuration
          .ApolloPlugin as Instance<typeof ApolloPluginConfigurationSchema>
        return pluginConfiguration
      },
      broadcastLocations() {
        const { internetAccounts } = getRoot<ApolloRootModel>(self)
        const locations: {
          assemblyName: string
          refName: string
          start: number
          end: number
        }[] = []
        for (const view of asAbstractSessionModel(self).views) {
          if (view.type !== 'LinearGenomeView') {
            return
          }
          const lgv = asLinearGenomeViewModel(view)
          if (lgv.initialized) {
            const { dynamicBlocks } = lgv
            for (const block of dynamicBlocks.contentBlocks) {
              const { assemblyName, end, refName, start } = block
              const assembly = self.apolloDataStore.assemblies.get(assemblyName)
              if (
                assembly &&
                assembly.backendDriverType === 'CollaborationServerDriver'
              ) {
                locations.push({ assemblyName, refName, start, end })
              }
            }
          }
        }
        if (locations.length === 0) {
          for (const internetAccount of getApolloInternetAccounts(
            internetAccounts,
          )) {
            internetAccount.postUserLocation([])
          }
          return
        }

        const allLocations: UserLocation[] = []
        for (const internetAccount of getApolloInternetAccounts(
          internetAccounts,
        )) {
          for (const location of locations) {
            const tmpLoc: UserLocation = {
              assemblyId: location.assemblyName,
              refSeq: location.refName,
              start: location.start,
              end: location.end,
            }
            allLocations.push(tmpLoc)
          }
          internetAccount.postUserLocation(allLocations)
        }
      },
    }))
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
        // @ts-expect-error type is missing on ApolloRootModel
        const { internetAccounts, jbrowse, reloadPluginManagerCallback } =
          getRoot<ApolloRootModel>(self)
        addDisposer(
          self,
          autorun(
            () => {
              // broadcastLocations() // **** This is not working and therefore we need to duplicate broadcastLocations() -method code here because autorun() does not observe changes otherwise
              const locations: {
                assemblyName: string
                refName: string
                start: number
                end: number
              }[] = []
              for (const view of asAbstractSessionModel(self).views) {
                if (view.type !== 'LinearGenomeView') {
                  return
                }
                const lgv = asLinearGenomeViewModel(view)
                if (lgv.initialized) {
                  const { dynamicBlocks } = lgv
                  for (const block of dynamicBlocks.contentBlocks) {
                    const { assemblyName, end, refName, start } = block
                    const assembly =
                      self.apolloDataStore.assemblies.get(assemblyName)
                    if (
                      assembly &&
                      assembly.backendDriverType === 'CollaborationServerDriver'
                    ) {
                      locations.push({ assemblyName, refName, start, end })
                    }
                  }
                }
              }
              if (locations.length === 0) {
                for (const internetAccount of getApolloInternetAccounts(
                  internetAccounts,
                )) {
                  internetAccount.postUserLocation([])
                }
                return
              }

              const allLocations: UserLocation[] = []
              for (const internetAccount of getApolloInternetAccounts(
                internetAccounts,
              )) {
                for (const location of locations) {
                  const tmpLoc: UserLocation = {
                    assemblyId: location.assemblyName,
                    refSeq: location.refName,
                    start: location.start,
                    end: location.end,
                  }
                  allLocations.push(tmpLoc)
                }
                internetAccount.postUserLocation(allLocations)
              }
            },
            { name: 'ApolloSessionBroadcastLocations' },
          ),
        )
        addDisposer(
          self,
          autorun(
            async (reaction) => {
              // When the initial config.json loads, it doesn't include the Apollo
              // tracks, which would result in a potentially invalid session snapshot
              // if any tracks are open. Here we copy the session snapshot, apply an
              // empty session snapshot, and then restore the original session
              // snapshot after the updated config.json loads.
              const pluginConfiguration = jbrowse.configuration
                .ApolloPlugin as Instance<
                typeof ApolloPluginConfigurationSchema
              >
              const hasRole = readConfObject(
                pluginConfiguration,
                'hasRole',
              ) as boolean
              const featureTypeOntologyName = readConfObject(
                pluginConfiguration,
                'featureTypeOntologyName',
              ) as string
              const hasApolloInternetAccount = internetAccounts.some((ia) =>
                isApolloInternetAccount(ia),
              )
              // Re-run this autorun after login/logout so role-gated config can be reloaded.
              const apolloAuthSignature = internetAccounts
                .filter((ia) => isAlive(ia))
                .filter((ia) => isApolloInternetAccount(ia))
                .map(
                  (ia) =>
                    `${ia.internetAccountId}:${ia.role ?? ''}:${Boolean(
                      safeRetrieveToken(ia),
                    )}`,
                )
                .join('|')
              void apolloAuthSignature
              const nonApolloAssemblies = asAbstractSessionModel(
                self,
              ).assemblyManager.assemblies.filter(
                (a) =>
                  !(
                    getConf(a, ['sequence', 'metadata']) as {
                      apollo?: boolean
                    }
                  ).apollo,
              )
              if (!hasApolloInternetAccount || hasRole) {
                // Wait for assemblyManager to load before we do this part
                const { assemblies } =
                  asAbstractSessionModel(self).assemblyManager
                if (assemblies.length === 0) {
                  return
                }

                const sessionModel = asAbstractSessionModel(self)
                const [signedInApolloAccount] = internetAccounts
                  .filter((ia): ia is ApolloInternetAccountModel =>
                    isApolloInternetAccount(ia),
                  )
                  .filter((ia) => Boolean(safeRetrieveToken(ia)))
                  .sort((a, b) => {
                    const aToken = safeRetrieveToken(a)
                    const bToken = safeRetrieveToken(b)
                    const aGuest = aToken ? isGuestToken(aToken) : true
                    const bGuest = bToken ? isGuestToken(bToken) : true
                    return Number(aGuest) - Number(bGuest)
                  })
                const signedInToken = signedInApolloAccount
                  ? safeRetrieveToken(signedInApolloAccount)
                  : undefined

                if (!signedInToken || isGuestToken(signedInToken)) {
                  self.apolloSetSelectedFeature()
                  removeApolloTracksFromSession(sessionModel)
                  reaction.dispose()
                  return
                }

                const { pluginConfiguration } = self.apolloDataStore
                const configuredOntologies =
                  pluginConfiguration.ontologies as AnyConfigurationModel[]
                const featureTypeOntology = configuredOntologies.find(
                  (ont) =>
                    readConfObject(ont, 'name') === featureTypeOntologyName,
                )
                if (!featureTypeOntology) {
                  pluginConfiguration.addOntology({
                    name: 'Sequence Ontology',
                    version: '01c33c6d9b6c8dca12e7d3e37b49ee113093c2fa',
                    source: {
                      uri: 'https://raw.githubusercontent.com/The-Sequence-Ontology/SO-Ontologies/01c33c6d9b6c8dca12e7d3e37b49ee113093c2fa/Ontology_Files/so.json',
                      locationType: 'UriLocation',
                    },
                  })
                }

                const viewableAssemblyNames =
                  await getViewableAssemblyNamesForAccount(
                    signedInApolloAccount,
                    self.abortController.signal,
                  )

                self.apolloSetSelectedFeature()
                // @ts-expect-error not sure why snapshot type is wrong for snapshot
                applySnapshot(self, self.previousSnapshot)
                removeApolloTracksFromSession(sessionModel)
                for (const a of nonApolloAssemblies) {
                  if (!viewableAssemblyNames.has(a.name)) {
                    continue
                  }
                  self.addApolloLocalTrackConfig(a)
                }
                reaction.dispose()
                return
              }

              const { signal } = self.abortController
              // fetch and initialize assemblies for each of our Apollo internet accounts
              for (const internetAccount of getApolloInternetAccounts(
                internetAccounts,
              )) {
                const { baseURL } = internetAccount
                const uri = new URL('jbrowse/config.json', baseURL).href
                const fetch = internetAccount.getFetcher({
                  locationType: 'UriLocation',
                  uri,
                })
                let response: Response
                try {
                  response = await fetch(uri, { signal })
                } catch (error) {
                  if (!self.abortController.signal.aborted) {
                    console.error(error)
                  }
                  continue
                }
                if (!response.ok) {
                  const errorMessage = await createFetchErrorMessage(
                    response,
                    'Failed to fetch assemblies',
                  )
                  console.error(errorMessage)
                  continue
                }
                let jbrowseConfig
                try {
                  jbrowseConfig = await response.json()
                } catch (error) {
                  console.error(error)
                  continue
                }

                if (!jbrowseConfig.configuration.ApolloPlugin.hasRole) {
                  continue
                }
                const normalizedJBrowseConfig = normalizeConfigAssemblyNames(
                  jbrowseConfig as JBrowseConfig,
                )

                reloadPluginManagerCallback(
                  normalizedJBrowseConfig,
                  self.previousSnapshot,
                )
                reaction.dispose()
              }
            },
            { name: 'ApolloSessionLoadConfig' },
          ),
        )
      },
      beforeDestroy() {
        self.abortController.abort(
          new DOMException('Clean up Apollo session', 'AbortError'),
        )
      },
    }))

    .views((self) => {
      const superTrackActions = (self as unknown as AbstractSessionModel)
        .getTrackActions
      return {
        getTrackActions(conf: BaseTrackConfig) {
          if (
            conf.type === 'ApolloTrack' ||
            conf.type === 'ReferenceSequenceTrack'
          ) {
            return superTrackActions?.(conf)
          }
          const trackId = readConfObject(conf, 'trackId') as string
          const sessionTrackIdentifier = '-sessionTrack'
          const isSessionTrack = trackId.endsWith(sessionTrackIdentifier)
          return isSessionTrack
            ? [
                ...(superTrackActions?.(conf) ?? []),
                {
                  label: 'Save track to Apollo',
                  onClick: async () => {
                    const { internetAccounts, jbrowse } =
                      getRoot<ApolloRootModel>(self)
                    const currentConfig = getSnapshot<JBrowseConfig>(jbrowse)
                    let filteredConfig: JBrowseConfig | undefined
                    filteredConfig = filterJBrowseConfig(currentConfig)
                    if (Object.keys(filteredConfig).length === 0) {
                      filteredConfig = undefined
                    }
                    const trackConfigSnapshot = getSnapshot(conf)
                    const newTrackId = trackId.slice(
                      0,
                      trackId.length - sessionTrackIdentifier.length,
                    )
                    const newTrackConfigSnapshot = {
                      ...trackConfigSnapshot,
                      trackId: newTrackId,
                    }
                    for (const internetAccount of getApolloInternetAccounts(
                      internetAccounts,
                    )) {
                      const change = new ImportJBrowseConfigChange({
                        typeName: 'ImportJBrowseConfigChange',
                        oldJBrowseConfig: filteredConfig,
                        newJBrowseConfig: {
                          ...filteredConfig,
                          // @ts-expect-error The track types are in the snapshot
                          tracks: filteredConfig?.tracks && [
                            ...filteredConfig.tracks,
                            newTrackConfigSnapshot,
                          ],
                        },
                      })
                      const { internetAccountId } = internetAccount
                      await self.apolloDataStore.changeManager.submit(change, {
                        internetAccountId,
                      })
                      const { notify } = self as unknown as AbstractSessionModel
                      notify('Track added', 'success')
                    }
                    // @ts-expect-error This method is missing in the JB types
                    self.deleteTrackConf(conf)

                    jbrowse.addTrackConf(newTrackConfigSnapshot)
                  },
                  icon: SaveIcon,
                },
              ]
            : [
                ...(superTrackActions?.(conf) ?? []),
                {
                  label: 'Remove track from Apollo',
                  onClick: async () => {
                    const { internetAccounts, jbrowse } =
                      getRoot<ApolloRootModel>(self)
                    const currentConfig = getSnapshot<JBrowseConfig>(jbrowse)
                    let filteredConfig: JBrowseConfig | undefined
                    filteredConfig = filterJBrowseConfig(currentConfig)
                    if (Object.keys(filteredConfig).length === 0) {
                      filteredConfig = undefined
                    }
                    const filteredTracks = filteredConfig?.tracks?.filter(
                      (t) => t.trackId !== trackId,
                    )
                    for (const internetAccount of getApolloInternetAccounts(
                      internetAccounts,
                    )) {
                      const change = new ImportJBrowseConfigChange({
                        typeName: 'ImportJBrowseConfigChange',
                        oldJBrowseConfig: filteredConfig,
                        newJBrowseConfig: {
                          ...filteredConfig,
                          tracks: filteredTracks,
                        },
                      })
                      const { internetAccountId } = internetAccount
                      await self.apolloDataStore.changeManager.submit(change, {
                        internetAccountId,
                      })
                      const { notify } = self as unknown as AbstractSessionModel
                      notify('Track removed', 'success')
                    }
                    // @ts-expect-error This method is missing in the JB types
                    self.deleteTrackConf(conf)

                    jbrowse.deleteTrackConf(conf)
                  },
                  icon: SaveIcon,
                },
              ]
        },
      }
    })
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
