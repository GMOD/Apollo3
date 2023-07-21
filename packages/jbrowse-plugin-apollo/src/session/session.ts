import { AssemblyModel } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { ClientDataStore as ClientDataStoreType } from 'apollo-common'
import { AnnotationFeature, AnnotationFeatureI } from 'apollo-mst'
import { autorun, observable } from 'mobx'
import { IAnyModelType, Instance, flow, getRoot, types } from 'mobx-state-tree'

import {
  ApolloInternetAccountModel,
  UserLocation,
} from '../ApolloInternetAccount/model'
import { ChangeManager } from '../ChangeManager'
import { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'
import { clientDataStoreFactory } from './ClientDataStore'

export interface ApolloSession extends AbstractSessionModel {
  apolloDataStore: ClientDataStoreType & { changeManager: ChangeManager }
  apolloSelectedFeature?: AnnotationFeatureI
  apolloSetSelectedFeature(feature?: AnnotationFeatureI): void
}

interface ApolloAssemblyResponse {
  _id: string
  name: string
  displayName?: string
  description?: string
  aliases?: string[]
}

export interface ApolloRefSeqResponse {
  _id: string
  name: string
  description?: string
  length: string
  assembly: string
}

export interface CollaboratorLocation {
  assemblyId: string
  refSeq: string
  start: number
  end: number
}

export interface Collaborator {
  name: string
  id: string
  locations: CollaboratorLocation[]
}

export function extendSession(
  pluginManager: PluginManager,
  sessionModel: IAnyModelType,
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
      apolloSelectedFeature: types.maybe(
        types.reference(AnnotationFeatureExtended),
      ),
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
            if (!existingCollaborator) {
              collabs.push(collaborator)
            } else {
              existingCollaborator.locations = collaborator.locations
            }
          },
        },
      }
    })
    .actions((self) => ({
      apolloSetSelectedFeature(feature?: AnnotationFeatureI) {
        self.apolloSelectedFeature = feature
      },
      addApolloTrackConfig(assembly: AssemblyModel) {
        const trackId = `apollo_track_${assembly.name}`
        const hasTrack = Boolean(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          self.tracks.find((track: any) => track.trackId === trackId),
        )
        if (!hasTrack) {
          self.addTrackConf({
            type: 'ApolloTrack',
            trackId,
            name: `Annotations (${
              getConf(assembly, 'displayName') || assembly.name
            })`,
            assemblyNames: [assembly.name],
            displays: [
              {
                type: 'LinearApolloDisplay',
                displayId: `apollo_track_${assembly.name}-LinearApolloDisplay`,
              },
              {
                type: 'SixFrameFeatureDisplay',
                displayId: `apollo_track_${assembly.name}-SixFrameFeatureDisplay`,
              },
            ],
          })
        }
      },
      broadcastLocations() {
        const { internetAccounts } = getRoot<ApolloRootModel>(
          self,
        ) as AppRootModel
        const locations: {
          assemblyName: string
          refName: string
          start: number
          end: number
        }[] = []
        for (const view of self.views) {
          if (view.type === 'LinearGenomeView' && view.initialized) {
            const { dynamicBlocks } = view as LinearGenomeViewModel
            dynamicBlocks.forEach((block) => {
              if (block.regionNumber !== undefined) {
                const { assemblyName, refName, start, end } = block
                locations.push({ assemblyName, refName, start, end })
              }
            })
          }
        }
        if (!locations.length) {
          for (const internetAccount of internetAccounts as (
            | BaseInternetAccountModel
            | ApolloInternetAccountModel
          )[]) {
            if ('baseURL' in internetAccount) {
              internetAccount.postUserLocation([])
            }
          }
          return
        }

        const allLocations: UserLocation[] = []
        for (const internetAccount of internetAccounts as (
          | BaseInternetAccountModel
          | ApolloInternetAccountModel
        )[]) {
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
      afterCreate: flow(function* afterCreate() {
        const { internetAccounts } = getRoot<ApolloRootModel>(
          self,
        ) as AppRootModel
        autorun(
          () => {
            // broadcastLocations() // **** This is not working and therefore we need to duplicate broadcastLocations() -method code here because autorun() does not observe changes otherwise
            const locations: {
              assemblyName: string
              refName: string
              start: number
              end: number
            }[] = []
            for (const view of self.views) {
              if (view.type === 'LinearGenomeView' && view.initialized) {
                const { dynamicBlocks } = view as LinearGenomeViewModel
                dynamicBlocks.forEach((block) => {
                  if (block.regionNumber !== undefined) {
                    const { assemblyName, refName, start, end } = block
                    locations.push({ assemblyName, refName, start, end })
                  }
                })
              }
            }
            if (!locations.length) {
              for (const internetAccount of internetAccounts as (
                | BaseInternetAccountModel
                | ApolloInternetAccountModel
              )[]) {
                if ('baseURL' in internetAccount) {
                  internetAccount.postUserLocation([])
                }
              }
              return
            }

            const allLocations: UserLocation[] = []
            for (const internetAccount of internetAccounts as (
              | BaseInternetAccountModel
              | ApolloInternetAccountModel
            )[]) {
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
          const uri = new URL('assemblies', baseURL).href
          const fetch = internetAccount.getFetcher({
            locationType: 'UriLocation',
            uri,
          })
          let response: Response
          try {
            response = yield fetch(uri, { signal })
          } catch (e) {
            console.error(e)
            // setError(e instanceof Error ? e : new Error(String(e)))
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
          let fetchedAssemblies
          try {
            fetchedAssemblies =
              (yield response.json()) as ApolloAssemblyResponse[]
          } catch (e) {
            console.error(e)
            continue
          }
          for (const assembly of fetchedAssemblies) {
            const { assemblyManager } = self
            const selectedAssembly = assemblyManager.get(assembly.name)
            if (selectedAssembly) {
              self.addApolloTrackConfig(selectedAssembly)
              continue
            }
            const url = new URL('refSeqs', baseURL)
            const searchParams = new URLSearchParams({ assembly: assembly._id })
            url.search = searchParams.toString()
            const uri2 = url.toString()
            const fetch2 = internetAccount.getFetcher({
              locationType: 'UriLocation',
              uri: uri2,
            })
            const response2 = (yield fetch2(uri2, {
              signal,
            })) as unknown as Response
            if (!response2.ok) {
              let errorMessage
              try {
                errorMessage = yield response2.text()
              } catch (e) {
                errorMessage = ''
              }
              throw new Error(
                `Failed to fetch fasta info — ${response2.status} (${
                  response2.statusText
                })${errorMessage ? ` (${errorMessage})` : ''}`,
              )
            }
            const f = (yield response2.json()) as ApolloRefSeqResponse[]
            const ids: Record<string, string> = {}
            const refNameAliasesFeatures = f.map((contig) => {
              ids[contig.name] = contig._id
              return {
                refName: contig.name,
                aliases: [contig._id],
                uniqueId: `alias-${contig._id}`,
              }
            })
            const assemblyConfig = {
              name: assembly._id,
              aliases: [assembly.name, ...(assembly.aliases ?? [])],
              displayName: assembly.displayName ?? assembly.name,
              sequence: {
                trackId: `sequenceConfigId-${assembly.name}`,
                type: 'ReferenceSequenceTrack',
                adapter: {
                  type: 'ApolloSequenceAdapter',
                  assemblyId: assembly._id,
                  baseURL: { uri: baseURL, locationType: 'UriLocation' },
                },
                metadata: {
                  apollo: true,
                  internetAccountConfigId:
                    internetAccount.configuration.internetAccountId,
                  ids,
                },
              },
              refNameAliases: {
                adapter: {
                  type: 'FromConfigAdapter',
                  features: refNameAliasesFeatures,
                },
              },
            }
            ;(self.addSessionAssembly || self.addAssembly)(assemblyConfig)
            const a = yield assemblyManager.waitForAssembly(assemblyConfig.name)
            self.addApolloTrackConfig(a)
          }
        }
      }),
      beforeDestroy() {
        aborter.abort()
      },
    }))
}

export type ApolloSessionStateModel = ReturnType<typeof extendSession>
export type ApolloSessionModel = Instance<ApolloSessionStateModel>
