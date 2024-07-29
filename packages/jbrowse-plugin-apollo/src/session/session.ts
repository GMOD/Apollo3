/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ClientDataStore as ClientDataStoreType } from '@apollo-annotation/common'
import { AnnotationFeature, AnnotationFeatureI } from '@apollo-annotation/mst'
import {
  DeleteTrackChange,
  SaveTrackChange,
  UserLocation,
} from '@apollo-annotation/shared'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import SaveIcon from '@mui/icons-material/Save'
import { autorun, observable } from 'mobx'
import {
  Instance,
  applySnapshot,
  flow,
  getRoot,
  getSnapshot,
  types,
} from 'mobx-state-tree'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloJobModel } from '../ApolloJobModel'
import { ChangeManager } from '../ChangeManager'
import { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'
import { clientDataStoreFactory } from './ClientDataStore'

export interface ApolloSession extends AbstractSessionModel {
  apolloDataStore: ClientDataStoreType & { changeManager: ChangeManager }
  apolloSelectedFeature?: AnnotationFeatureI
  apolloSetSelectedFeature(feature?: AnnotationFeatureI): void
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
    AnnotationFeature,
  ) as typeof AnnotationFeature
  const ClientDataStore = clientDataStoreFactory(AnnotationFeatureExtended)
  return sessionModel
    .props({
      apolloDataStore: types.optional(ClientDataStore, { typeName: 'Client' }),
      apolloSelectedFeature: types.safeReference(AnnotationFeatureExtended),
      jobsManager: types.optional(ApolloJobModel, {}),
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
    .actions((self) => ({
      apolloSetSelectedFeature(feature?: AnnotationFeatureI) {
        self.apolloSelectedFeature = feature
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
                locations.push({ assemblyName, refName, start, end })
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
        // When the initial config.json loads, it doesn't include the Apollo
        // tracks, which would result in a potentially invalid session snapshot
        // if any tracks are open. Here we copy the session snapshot, apply an
        // empty session snapshot, and then restore the original session
        // snapshot after the updated config.json loads.
        const sessionSnapshot = getSnapshot(self)
        const { id, name } = sessionSnapshot
        applySnapshot(self, { name, id })
        const { internetAccounts, jbrowse } = getRoot<ApolloRootModel>(self)
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
                    locations.push({ assemblyName, refName, start, end })
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
        // END AUTORUN

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
          applySnapshot(jbrowse, jbrowseConfig)
          applySnapshot(self, sessionSnapshot)
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
          const metadata = readConfObject(conf, 'metadata')
          return metadata.savedToApollo
            ? [
                ...(superTrackActionMenuItems?.(conf) ?? []),
                {
                  label: 'Remove track from Apollo',
                  onClick: async () => {
                    const { internetAccounts } = getRoot<ApolloRootModel>(self)
                    for (const internetAccount of internetAccounts as ApolloInternetAccountModel[]) {
                      if (internetAccount.type !== 'ApolloInternetAccount') {
                        continue
                      }
                      const change = new DeleteTrackChange({
                        typeName: 'DeleteTrackChange',
                        trackConfig: JSON.stringify(conf),
                        changes: [],
                      })
                      const { internetAccountId } = internetAccount
                      await self.apolloDataStore.changeManager.submit(change, {
                        internetAccountId,
                      })
                      const { notify } = self as unknown as AbstractSessionModel
                      notify('Track removed from Apollo', 'success')
                    }
                  },
                  icon: SaveIcon,
                },
              ]
            : [
                ...(superTrackActionMenuItems?.(conf) ?? []),
                {
                  label: 'Save track to Apollo',
                  onClick: async () => {
                    const { internetAccounts } = getRoot<ApolloRootModel>(self)
                    for (const internetAccount of internetAccounts as ApolloInternetAccountModel[]) {
                      if (internetAccount.type !== 'ApolloInternetAccount') {
                        continue
                      }
                      const change = new SaveTrackChange({
                        typeName: 'SaveTrackChange',
                        trackConfig: JSON.stringify(conf),
                        changes: [],
                      })
                      const { internetAccountId } = internetAccount
                      await self.apolloDataStore.changeManager.submit(change, {
                        internetAccountId,
                      })
                      const { notify } = self as unknown as AbstractSessionModel
                      notify('Track information saved to Apollo', 'success')
                    }
                  },
                  icon: SaveIcon,
                },
              ]
        },
      }
    })
}

export type ApolloSessionStateModel = ReturnType<typeof extendSession>
export type ApolloSessionModel = Instance<ApolloSessionStateModel>
