/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  type AnnotationFeature,
  AnnotationFeatureModel,
} from '@apollo-annotation/mst'
import {
  ImportJBrowseConfigChange,
  type JBrowseConfig,
  type UserLocation,
  filterJBrowseConfig,
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
        const hasTrack = (self as unknown as AbstractSessionModel).tracks.some(
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
        const pluginConfiguration =
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          jbrowse.configuration.ApolloPlugin as Instance<
            typeof ApolloPluginConfigurationSchema
          >
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
        for (const view of (self as unknown as AbstractSessionModel).views) {
          if (view.type !== 'LinearGenomeView') {
            return
          }
          const lgv = view as unknown as LinearGenomeViewModel
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
          for (const internetAccount of internetAccounts) {
            if (isApolloInternetAccount(internetAccount)) {
              internetAccount.postUserLocation([])
            }
          }
          return
        }

        const allLocations: UserLocation[] = []
        for (const internetAccount of internetAccounts) {
          if (isApolloInternetAccount(internetAccount)) {
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
                for (const internetAccount of internetAccounts) {
                  if (isApolloInternetAccount(internetAccount)) {
                    internetAccount.postUserLocation([])
                  }
                }
                return
              }

              const allLocations: UserLocation[] = []
              for (const internetAccount of internetAccounts) {
                if (isApolloInternetAccount(internetAccount)) {
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
              const pluginConfiguration =
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                jbrowse.configuration.ApolloPlugin as Instance<
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
              if (!hasApolloInternetAccount || hasRole) {
                // Wait for assemblyManager to load before we do this part
                const { assemblies } = (self as unknown as AbstractSessionModel)
                  .assemblyManager
                if (assemblies.length === 0) {
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
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                  pluginConfiguration.addOntology({
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
                // @ts-expect-error not sure why snapshot type is wrong for snapshot
                applySnapshot(self, self.previousSnapshot)
                reaction.dispose()
                return
              }

              const { signal } = self.abortController
              // fetch and initialize assemblies for each of our Apollo internet accounts
              for (const internetAccount of internetAccounts as ApolloInternetAccountModel[]) {
                if (internetAccount.type !== 'ApolloInternetAccount') {
                  continue
                }

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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (!jbrowseConfig.configuration.ApolloPlugin.hasRole) {
                  continue
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                reloadPluginManagerCallback(
                  jbrowseConfig,
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
      const superTrackActionMenuItems = (
        self as unknown as AbstractSessionModel
      ).getTrackActionMenuItems
      return {
        getTrackActionMenuItems(conf: BaseTrackConfig) {
          if (
            conf.type === 'ApolloTrack' ||
            conf.type === 'ReferenceSequenceTrack'
          ) {
            return superTrackActionMenuItems?.(conf)
          }
          const trackId = readConfObject(conf, 'trackId') as string
          const sessionTrackIdentifier = '-sessionTrack'
          const isSessionTrack = trackId.endsWith(sessionTrackIdentifier)
          return isSessionTrack
            ? [
                ...(superTrackActionMenuItems?.(conf) ?? []),
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
                    for (const internetAccount of internetAccounts as ApolloInternetAccountModel[]) {
                      if (internetAccount.type !== 'ApolloInternetAccount') {
                        continue
                      }
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
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    jbrowse.addTrackConf(newTrackConfigSnapshot)
                  },
                  icon: SaveIcon,
                },
              ]
            : [
                ...(superTrackActionMenuItems?.(conf) ?? []),
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
                    for (const internetAccount of internetAccounts as ApolloInternetAccountModel[]) {
                      if (internetAccount.type !== 'ApolloInternetAccount') {
                        continue
                      }
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
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
