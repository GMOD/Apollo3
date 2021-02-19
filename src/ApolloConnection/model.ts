import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { apolloFetch } from '../apolloFetch'
import configSchema from './configSchema'

interface Organism {
  commonName: string
  id: number
}

export default function(pluginManager: PluginManager) {
  const { types } = pluginManager.lib['mobx-state-tree']
  return types
    .compose(
      'ApolloConnection',
      BaseConnectionModelFactory(pluginManager),
      types.model({
        configuration: ConfigurationReference(configSchema),
        type: types.literal('ApolloConnection'),
      }),
    )
    .actions(self => ({
      connect() {
        return apolloFetch(
          self.configuration.apolloConfig,
          'organism/findAllOrganisms',
        )
          .then(response => response.json())
          .then((result: Organism[]) => {
            result.forEach(organism => {
              const apolloConfig = readConfObject(
                self.configuration,
                'apolloConfig',
              )
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
}
