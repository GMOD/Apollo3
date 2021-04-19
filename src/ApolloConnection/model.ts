import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { Client } from '@stomp/stompjs'
import { SnapshotOrInstance } from 'mobx-state-tree'
import { apolloFetch } from '../apolloFetch'
import configSchema from './configSchema'
import Feature from './ApolloFeature'
import ApolloAnnotationDriver from './ApolloAnnotationDriver'

interface Organism {
  commonName: string
  id: number
}

export default function(pluginManager: PluginManager) {
  const { types } = pluginManager.lib['mobx-state-tree']

  const Ref = types.map(types.map(Feature))
  const AssemblyMap = types.map(Ref)
  const ApolloConnection = types
    .compose(
      'ApolloConnection',
      BaseConnectionModelFactory(pluginManager),
      types.model({
        configuration: ConfigurationReference(configSchema),
        type: types.literal('ApolloConnection'),
        features: AssemblyMap,
      }),
    )
    .volatile(() => ({
      client: undefined as Client | undefined,
    }))
    .actions(self => ({
      setClient(client: Client | undefined) {
        self.client = client
      },
      setFeatures(
        organismName: string,
        refName: string,
        features: Record<string, SnapshotOrInstance<typeof Feature>>,
      ) {
        let organism = self.features.get(organismName)
        if (!organism) {
          self.features.set(organismName, {})
          organism = self.features.get(organismName)!
        }
        organism.set(refName, features)
      },
      addFeatures(
        organismName: string,
        refName: string,
        features: Record<string, SnapshotOrInstance<typeof Feature>>,
      ) {
        let organism = self.features.get(organismName)
        if (!organism) {
          self.features.set(organismName, {})
          organism = self.features.get(organismName)!
        }
        let ref = organism.get(refName)
        if (!ref) {
          organism.set(refName, {})
          ref = organism.get(refName)!
        }
        for (const [id, feature] of Object.entries(features)) {
          ref.set(id, feature)
        }
      },
      connect() {
        return apolloFetch(
          self.configuration.apolloConfig,
          'organism/findAllOrganisms',
        )
          .then(response => response.json())
          .then((result: Organism[]) => {
            const organismNames = result.map(organism => organism.commonName)
            const a = new ApolloAnnotationDriver(
              self.configuration,
              self.features,
              organismNames,
            )
            result.forEach(organism => {
              a.getOrganisms().then(orgs => {
                const org = orgs.get(organism.commonName)
                if (org) {
                  org.forEach((length, refName) => {
                    a.getFeatures({
                      assemblyName: organism.commonName,
                      start: 0,
                      end: length,
                      refName,
                    }).then(features => {
                      this.addFeatures(organism.commonName, refName, features)
                    })
                  })
                }
              })
              const apolloConfig = readConfObject(
                self.configuration,
                'apolloConfig',
              )
              // @ts-ignore
              self.addTrackConf({
                type: 'ApolloTrack',
                trackId: `apollo_track_${self.name}_${organism.id}`,
                name: `Apollo Track ${organism.commonName}`,
                assemblyNames: [organism.commonName],
                adapter: {
                  type: 'ApolloAdapter',
                  apolloConfig,
                },
                apolloConfig,
                displays: [
                  {
                    type: 'LinearApolloDisplay',
                    displayId: `apollo_track_${self.name}_${organism.id}-LinearApolloDisplay`,
                    apolloConfig,
                  },
                ],
              })
            })
          })
      },
    }))

  return ApolloConnection
}
