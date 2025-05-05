import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import ApolloRefNameAliasAdapter from './ApolloRefNameAliasAdapter'
import configSchema from './configSchema'

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
