import { AssemblyModel } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import { AbstractSessionModel, AppRootModel, Region } from '@jbrowse/core/util'
import {
  AnnotationFeatureLocation,
  AnnotationFeatureLocationI,
  FeaturesForRefName,
} from 'apollo-mst'
import {
  ChangeManager,
  CollaborationServerDriver,
  CoreValidation,
  ValidationSet,
} from 'apollo-shared'
import { IAnyModelType, flow, getRoot, types } from 'mobx-state-tree'

import { ApolloInternetAccountModel } from './ApolloInternetAccount/model'

export interface ApolloSession extends AbstractSessionModel {
  apolloDataStore: any
  apolloSelectedFeature?: AnnotationFeatureLocationI
  apolloSetSelectedFeature(feature?: AnnotationFeatureLocationI): void
}

interface ApolloAssembly {
  _id: string
  name: string
  displayName?: string
  description?: string
  aliases?: string[]
}

interface ApolloRefSeq {
  _id: string
  name: string
  description?: string
  length: string
  assembly: string
}

const ClientDataStore = types
  .model('ClientDataStore', {
    typeName: types.optional(types.literal('Client'), 'Client'),
    assemblies: types.map(FeaturesForRefName),
    backendDriverType: types.optional(
      types.enumeration('backendDriverType', ['CollaborationServerDriver']),
      'CollaborationServerDriver',
    ),
    internetAccountConfigId: types.maybe(types.string),
  })
  .volatile((self) => {
    if (self.backendDriverType !== 'CollaborationServerDriver') {
      throw new Error(`Unknown backend driver type "${self.backendDriverType}"`)
    }
    return {
      backendDriver: new CollaborationServerDriver(self),
    }
  })
  .volatile((self) => ({
    changeManager: new ChangeManager(
      self,
      new ValidationSet([new CoreValidation()]),
    ),
  }))
  .views((self) => ({
    get internetAccounts() {
      return (getRoot(self) as AppRootModel).internetAccounts
    },
  }))
  .actions((self) => ({
    loadFeatures: flow(function* loadFeatures(regions: Region[]) {
      for (const region of regions) {
        const { assemblyName, refName } = region
        let assembly = self.assemblies.get(assemblyName)
        if (!assembly) {
          self.assemblies.set(assemblyName, {})
          assembly = self.assemblies.get(assemblyName)
          if (!assembly) {
            throw new Error(`Adding assembly "${assemblyName}" failed`)
          }
        }
        let ref = assembly.get(refName)
        if (!ref) {
          assembly.set(refName, {})
          ref = assembly.get(refName)
          if (!ref) {
            throw new Error(`Adding assembly "${refName}" failed`)
          }
        }
        const features = yield self.backendDriver.getFeatures(region)
        ref.merge(features[refName])
      }
    }),
  }))

export function extendSession(sessionModel: IAnyModelType) {
  const aborter = new AbortController()
  const { signal } = aborter
  return sessionModel
    .props({
      apolloDataStore: types.optional(ClientDataStore, { typeName: 'Client' }),
      apolloSelectedFeature: types.maybe(
        types.reference(AnnotationFeatureLocation),
      ),
    })
    .actions((self) => ({
      apolloSetSelectedFeature(feature?: AnnotationFeatureLocationI) {
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
            ],
          })
        }
      },
      afterCreate: flow(function* afterCreate() {
        const { internetAccounts } = getRoot(self) as AppRootModel
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
            return
          }
          if (!response.ok) {
            let errorMessage
            try {
              errorMessage = yield response.text()
            } catch (e) {
              errorMessage = ''
            }
            console.error(
              `Failed to fetch assemblies — ${response.status} (${
                response.statusText
              })${errorMessage ? ` (${errorMessage})` : ''}`,
            )
            return
          }
          let fetchedAssemblies
          try {
            fetchedAssemblies =
              (yield response.json()) as unknown as ApolloAssembly[]
          } catch (e) {
            console.error(e)
            return
          }
          for (const assembly of fetchedAssemblies) {
            const { assemblyManager } = self
            const selectedAssembly = assemblyManager.get(assembly.name)
            if (selectedAssembly) {
              self.addApolloTrackConfig(selectedAssembly)
              return
            }
            const searchParams = new URLSearchParams({
              assembly: assembly._id,
            })
            const uri2 = new URL(`refSeqs?${searchParams.toString()}`, baseURL)
              .href
            const fetch2 = internetAccount.getFetcher({
              locationType: 'UriLocation',
              uri: uri2,
            })
            const response2 = (yield fetch2(uri2, {
              signal,
            })) as unknown as Response
            if (!response.ok) {
              let errorMessage
              try {
                errorMessage = yield response.text()
              } catch (e) {
                errorMessage = ''
              }
              throw new Error(
                `Failed to fetch fasta info — ${response.status} (${
                  response.statusText
                })${errorMessage ? ` (${errorMessage})` : ''}`,
              )
            }
            const f = (yield response2.json()) as unknown as ApolloRefSeq[]
            const features = f.map((contig) => ({
              refName: contig.name,
              uniqueId: contig._id,
              start: 0,
              end: contig.length,
            }))
            const assemblyConfig = {
              name: assembly._id,
              aliases: [assembly.name, ...(assembly.aliases || [])],
              displayName: assembly.displayName || assembly.name,
              sequence: {
                trackId: `sequenceConfigId-${assembly.name}`,
                type: 'ReferenceSequenceTrack',
                adapter: { type: 'FromConfigRegionsAdapter', features },
                metadata: {
                  internetAccountConfigId:
                    internetAccount.configuration.internetAccountId,
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
