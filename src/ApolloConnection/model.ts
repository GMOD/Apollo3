import PluginManager from '@jbrowse/core/PluginManager'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import configSchema from './configSchema'

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
    .actions(() => ({
      connect() {},
    }))
}
