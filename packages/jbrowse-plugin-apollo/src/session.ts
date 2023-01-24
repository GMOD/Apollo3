import { AssemblyModel } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { AbstractSessionModel, AppRootModel, Region } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { ClientDataStore as ClientDataStoreType } from 'apollo-common'
import {
  AnnotationFeature,
  AnnotationFeatureI,
  AnnotationFeatureSnapshot,
  ApolloAssembly,
  ApolloRefSeq,
  Sequence,
} from 'apollo-mst'
import { autorun, observable } from 'mobx'
import {
  IAnyModelType,
  Instance,
  flow,
  getParentOfType,
  getRoot,
  resolveIdentifier,
  types,
} from 'mobx-state-tree'

import {
  ApolloInternetAccountModel,
  UserLocation,
} from './ApolloInternetAccount/model'
import { BackendDriver, CollaborationServerDriver } from './BackendDrivers'
import { ChangeManager } from './ChangeManager'
import { createFetchErrorMessage } from './util'

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

interface ApolloRefSeqResponse {
  _id: string
  name: string
  description?: string
  length: string
  assembly: string
}

export interface CollaboratorLocation {
  assembly: string
  refName: string
  start: number
  end: number
}

export interface Collaborator {
  name: string
  id: string
  locations: CollaboratorLocation[]
}

const ClientDataStore = types
  .model('ClientDataStore', {
    typeName: types.optional(types.literal('Client'), 'Client'),
    assemblies: types.map(ApolloAssembly),
    backendDriverType: types.optional(
      types.enumeration('backendDriverType', ['CollaborationServerDriver']),
      'CollaborationServerDriver',
    ),
  })
  .views((self) => ({
    get internetAccounts() {
      return (getRoot(self) as AppRootModel).internetAccounts
    },
    getFeature(featureId: string) {
      return resolveIdentifier(AnnotationFeature, self.assemblies, featureId)
    },
  }))
  .actions((self) => ({
    loadFeatures: flow(function* loadFeatures(regions: Region[]) {
      for (const region of regions) {
        const features = (yield (
          self as unknown as { backendDriver: BackendDriver }
        ).backendDriver.getFeatures(region)) as AnnotationFeatureSnapshot[]
        if (!features.length) {
          continue
        }
        const { assemblyName, refName } = region
        let assembly = self.assemblies.get(assemblyName)
        if (!assembly) {
          assembly = self.assemblies.put({ _id: assemblyName, refSeqs: {} })
        }
        const [firstFeature] = features
        let ref = assembly.refSeqs.get(firstFeature.refSeq)
        if (!ref) {
          ref = assembly.refSeqs.put({
            _id: firstFeature.refSeq,
            name: refName,
            features: {},
          })
        }
        const newFeatures: Record<string, AnnotationFeatureSnapshot> = {}
        features.forEach((feature) => {
          newFeatures[feature._id] = feature
        })
        ref.features.merge(newFeatures)
      }
    }),
    loadRefSeq: flow(function* loadRefSeq(regions: Region[]) {
      for (const region of regions) {
        const { seq, refSeq } = yield (
          self as unknown as { backendDriver: BackendDriver }
        ).backendDriver.getSequence(region)
        const { assemblyName, refName } = region
        let assembly = self.assemblies.get(assemblyName)
        if (!assembly) {
          assembly = self.assemblies.put({ _id: assemblyName, refSeqs: {} })
        }
        let ref = assembly.refSeqs.get(refSeq)
        if (!ref) {
          ref = assembly.refSeqs.put({
            _id: refSeq,
            name: refName,
            sequence: [],
          })
        }
        const newSequence = Sequence.create({
          start: region.start,
          stop: region.end,
          sequence: seq,
        })
        ref.sequence.push(newSequence)
      }
    }),

    addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot) {
      const assembly = self.assemblies.get(assemblyId)
      if (!assembly) {
        throw new Error(
          `Could not find assembly "${assemblyId}" to add feature "${feature._id}"`,
        )
      }
      const ref = assembly.refSeqs.get(feature.refSeq)
      if (!ref) {
        throw new Error(
          `Could not find refSeq "${feature.refSeq}" to add feature "${feature._id}"`,
        )
      }
      ref.features.put(feature)
    },
    addAssembly(assemblyId: string, assemblyName: string) {
      self.assemblies.put({ _id: assemblyId, refSeqs: {} })
    },
    deleteFeature(featureId: string) {
      const feature = self.getFeature(featureId)
      if (!feature) {
        throw new Error(`Could not find feature "${featureId}" to delete`)
      }
      const { parent } = feature
      if (parent) {
        parent.deleteChild(featureId)
      } else {
        const refSeq = getParentOfType(feature, ApolloRefSeq)
        refSeq.deleteFeature(feature._id)
      }
    },
    deleteAssembly(assemblyId: string) {
      self.assemblies.delete(assemblyId)
    },
  }))
  .volatile((self) => ({
    changeManager: new ChangeManager(self as unknown as ClientDataStoreType),
  }))
  .volatile((self) => {
    if (self.backendDriverType !== 'CollaborationServerDriver') {
      throw new Error(`Unknown backend driver type "${self.backendDriverType}"`)
    }
    return {
      backendDriver: new CollaborationServerDriver(self),
    }
  })

export function extendSession(sessionModel: IAnyModelType) {
  const aborter = new AbortController()
  const { signal } = aborter
  return sessionModel
    .props({
      apolloDataStore: types.optional(ClientDataStore, { typeName: 'Client' }),
      apolloSelectedFeature: types.maybe(types.reference(AnnotationFeature)),
    })
    .extend((self) => {
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
        const { internetAccounts } = getRoot(self) as AppRootModel
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
        const { internetAccounts } = getRoot(self) as AppRootModel
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
        for (const internetAccount of internetAccounts as ApolloInternetAccountModel[]) {
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
              aliases: [assembly.name, ...(assembly.aliases || [])],
              displayName: assembly.displayName || assembly.name,
              sequence: {
                trackId: `sequenceConfigId-${assembly.name}`,
                type: 'ReferenceSequenceTrack',
                adapter: {
                  type: 'ApolloSequenceAdapter',
                  assemblyId: assembly._id,
                  baseURL: { uri: baseURL, locationType: 'UriLocation' },
                },
                metadata: {
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
            self.addAssembly?.(assemblyConfig)
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
