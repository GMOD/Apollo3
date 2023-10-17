import { AssemblyModel } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  SessionWithConfigEditing,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { ClientDataStore as ClientDataStoreType } from 'apollo-common'
import { AnnotationFeature, AnnotationFeatureI } from 'apollo-mst'
import { autorun, observable } from 'mobx'
import { Instance, flow, getRoot, types } from 'mobx-state-tree'

import {
  ApolloInternetAccountModel,
  UserLocation,
} from '../ApolloInternetAccount/model'
import jobsModelFactory from '../ApolloJobModel'
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
  sessionModel: ReturnType<typeof types.model>,
) {
  const aborter = new AbortController()
  const { signal } = aborter
  const AnnotationFeatureExtended = pluginManager.evaluateExtensionPoint(
    'Apollo-extendAnnotationFeature',
    AnnotationFeature,
  ) as typeof AnnotationFeature
  const ClientDataStore = clientDataStoreFactory(AnnotationFeatureExtended)
  const JobsManager = jobsModelFactory(pluginManager)
  return sessionModel
    .props({
      apolloDataStore: types.optional(ClientDataStore, { typeName: 'Client' }),
      apolloSelectedFeature: types.safeReference(AnnotationFeatureExtended),
      jobsManager: types.optional(JobsManager, {}),
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
      addApolloTrackConfig(assembly: AssemblyModel, baseURL?: string) {
        const trackId = `apollo_track_${assembly.name}`
        const hasTrack = (self as unknown as AbstractSessionModel).tracks.some(
          (track) => track.trackId === trackId,
        )
        if (!hasTrack) {
          ;(self as unknown as SessionWithConfigEditing).addTrackConf({
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
            displays: [
              {
                type: 'LinearApolloDisplay',
                displayId: `${trackId}-LinearApolloDisplay`,
              },
              {
                type: 'SixFrameFeatureDisplay',
                displayId: `${trackId}-SixFrameFeatureDisplay`,
              },
            ],
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
                locations.push({ assemblyName, refName, start, end })
              }
            })
          }
        }
        if (locations.length === 0) {
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
    }))
    .actions((self) => ({
      afterCreate: flow(function* afterCreate() {
        const { internetAccounts } = getRoot<ApolloRootModel>(self)
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
                const { dynamicBlocks } = lgv as LinearGenomeViewModel
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

          const { baseURL, configuration } = internetAccount
          const uri = new URL('assemblies', baseURL).href
          const fetch = internetAccount.getFetcher({
            locationType: 'UriLocation',
            uri,
          })
          let response: Response
          try {
            response = yield fetch(uri, { signal })
          } catch (error) {
            console.error(error)
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
          } catch (error) {
            console.error(error)
            continue
          }
          for (const assembly of fetchedAssemblies) {
            const { addAssembly, addSessionAssembly, assemblyManager } =
              self as unknown as AbstractSessionModel & {
                // eslint-disable-next-line @typescript-eslint/ban-types
                addSessionAssembly: Function
              }
            const selectedAssembly = assemblyManager.get(assembly.name)
            if (selectedAssembly) {
              // @ts-expect-error MST type coercion problem?
              self.addApolloTrackConfig(selectedAssembly, baseURL)
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
              } catch {
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
                  internetAccountConfigId: configuration.internetAccountId,
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
            ;(addSessionAssembly || addAssembly)(assemblyConfig)
            const a = yield assemblyManager.waitForAssembly(assemblyConfig.name)
            self.addApolloTrackConfig(a, baseURL)
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
