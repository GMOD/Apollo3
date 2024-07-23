import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'

import configSchema from './configSchema'
import ApolloRefNameAliasAdapter from './ApolloRefNameAliasAdapter'

export function installApolloRefNameAliasAdapter(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'ApolloRefNameAliasAdapter',
        configSchema,
        adapterMetadata: {
          category: undefined,
          hiddenFromGUI: true,
          description: undefined,
        },
        AdapterClass: ApolloRefNameAliasAdapter,
      }),
  )
}
