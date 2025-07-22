/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type ClientDataStore as ClientDataStoreType } from '@apollo-annotation/common'
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
import { type AssemblyModel } from '@jbrowse/core/assemblyManager/assembly'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { type BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import {
  type AbstractSessionModel,
  type SessionWithAddTracks,
} from '@jbrowse/core/util'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import SaveIcon from '@mui/icons-material/Save'
import { autorun, observable } from 'mobx'
import {
  type Instance,
  type SnapshotOut,
  applySnapshot,
  flow,
  getRoot,
  getSnapshot,
  types,
} from 'mobx-state-tree'

import { type ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloJobModel } from '../ApolloJobModel'
import { type ChangeManager } from '../ChangeManager'
import type ApolloPluginConfigurationSchema from '../config'
import { type ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'

import { clientDataStoreFactory } from './ClientDataStore'

export interface ApolloSession extends AbstractSessionModel {
  apolloDataStore: ClientDataStoreType & { changeManager: ChangeManager }
  apolloSelectedFeature?: AnnotationFeature
  apolloSetSelectedFeature(feature?: AnnotationFeature): void
}

export interface Collaborator {
  name: string
  id: string
  locations: UserLocation[]
}

export function extendSession(
  pluginManager: PluginManager,
  sessionModel: ReturnType<typeof types.model>,
) {
  const aborter = new AbortController()
  const { signal } = aborter
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
    })
    .volatile(() => ({
      apolloHoveredFeature: undefined as AnnotationFeature | undefined,
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
      apolloSetSelectedFeature(feature?: AnnotationFeature) {
        // @ts-expect-error Not sure why TS thinks these MST types don't match
        self.apolloSelectedFeature = feature
      },
      apolloSetHoveredFeature(feature?: AnnotationFeature) {
        self.apolloHoveredFeature = feature
      },
      addApolloTrackConfig(assembly: AssemblyModel, baseURL?: string) {
        const trackId = `apollo_track_${assembly.name}`
        const hasTrack = (self as unknown as AbstractSessionModel).tracks.some(
          (track) => track.trackId === trackId,
        )
        if (!hasTrack) {
          ;(self as unknown as SessionWithAddTracks).addTrackConf({
            type: 'ApolloTrack',
            trackId,
            name: `Annotations (${
              // @ts-expect-error getConf types don't quite work here for some reason
              getConf(assembly, 'displayName') || assembly.name
            })`,
            assemblyNames: [assembly.name],
            textSearching: {
              textSearchAdapter: {
                type: 'ApolloTextSearchAdapter',
                trackId,
                assemblyNames: [assembly.name],
                textSearchAdapterId: `apollo_search_${assembly.name}`,
                ...(baseURL
                  ? { baseURL: { uri: baseURL, locationType: 'UriLocation' } }
                  : {}),
              },
            },
          })
        }
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
            // eslint-disable-next-line unicorn/no-array-for-each
            dynamicBlocks.forEach((block) => {
              if (block.regionNumber !== undefined) {
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
            })
          }
        }
        if (locations.length === 0) {
          for (const internetAccount of internetAccounts) {
            if ('baseURL' in internetAccount) {
              internetAccount.postUserLocation([])
            }
          }
          return
        }

        const allLocations: UserLocation[] = []
        for (const internetAccount of internetAccounts) {
          if ('baseURL' in internetAccount) {
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
      afterCreate: flow(function* afterCreate() {
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
                // eslint-disable-next-line unicorn/no-array-for-each
                dynamicBlocks.forEach((block) => {
                  if (block.regionNumber !== undefined) {
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
                })
              }
            }
            if (locations.length === 0) {
              for (const internetAccount of internetAccounts) {
                if ('baseURL' in internetAccount) {
                  internetAccount.postUserLocation([])
                }
              }
              return
            }

            const allLocations: UserLocation[] = []
            for (const internetAccount of internetAccounts) {
              if ('baseURL' in internetAccount) {
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
          { name: 'ApolloSession' },
        )
        // When the initial config.json loads, it doesn't include the Apollo
        // tracks, which would result in a potentially invalid session snapshot
        // if any tracks are open. Here we copy the session snapshot, apply an
        // empty session snapshot, and then restore the original session
        // snapshot after the updated config.json loads.
        // @ts-expect-error type is missing on ApolloRootModel
        const { internetAccounts, jbrowse, reloadPluginManagerCallback } =
          getRoot<ApolloRootModel>(self)
        const pluginConfiguration =
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          jbrowse.configuration.ApolloPlugin as Instance<
            typeof ApolloPluginConfigurationSchema
          >
        const hasRole = readConfObject(
          pluginConfiguration,
          'hasRole',
        ) as boolean
        if (hasRole) {
          return
        }
        const sessionSnapshot = getSnapshot(self)
        const { id, name } = sessionSnapshot
        applySnapshot(self, { name, id })

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
            response = yield fetch(uri, { signal })
          } catch (error) {
            console.error(error)
            continue
          }
          if (!response.ok) {
            const errorMessage = yield createFetchErrorMessage(
              response,
              'Failed to fetch assemblies',
            )
            console.error(errorMessage)
            continue
          }
          let jbrowseConfig
          try {
            jbrowseConfig = yield response.json()
          } catch (error) {
            console.error(error)
            continue
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          reloadPluginManagerCallback(jbrowseConfig, sessionSnapshot)
        }
      }),
      beforeDestroy() {
        aborter.abort('destroying session model')
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
                    const trackConfigSnapshot = getSnapshot(conf) as {
                      trackId: string
                      type: string
                    }
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
      const assemblies = Object.fromEntries(
        Object.entries(snap.apolloDataStore.assemblies).filter(
          ([, assembly]) => assembly.backendDriverType === 'InMemoryFileDriver',
        ),
      )
      // @ts-expect-error ontologyManager isn't actually required
      snap.apolloDataStore = {
        typeName: 'Client',
        assemblies,
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
        const assembly = apolloDataStore.assemblies.get(feature.assemblyId)
        if (assembly && assembly.backendDriverType === 'InMemoryFileDriver') {
          snap.apolloDataStore.checkResults[cr._id] = getSnapshot(cr)
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
