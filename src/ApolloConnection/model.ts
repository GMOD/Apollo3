import PluginManager from '@jbrowse/core/PluginManager'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import configSchema from './configSchema'
import apolloUrl from '../apolloUrl'

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
        return fetch(`${apolloUrl}/organism/findAllOrganisms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: sessionStorage.getItem('apolloUsername'),
            password: sessionStorage.getItem('apolloPassword'),
          }),
        })
          .then(response => response.json())
          .then((result: Organism[]) => {
            result.forEach(organism => {
              // @ts-ignore
              self.addTrackConf({
                type: 'ApolloTrack',
                trackId: `apollo_track_${organism.id}`,
                name: `Apollo Track ${organism.commonName}`,
                assemblyNames: [organism.commonName],
                adapter: {
                  type: 'ApolloAdapter',
                },
                displays: [],
              })
            })
          })
      },
    }))
}
