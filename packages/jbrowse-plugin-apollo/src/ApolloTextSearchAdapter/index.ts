import PluginManager from '@jbrowse/core/PluginManager'
import { TextSearchAdapterType } from '@jbrowse/core/pluggableElementTypes'

import { ApolloTextSearchAdapter } from './ApolloTextSearchAdapter'
import configSchema from './configSchema'

export function installApolloTextSearchAdapter(pluginManager: PluginManager) {
  pluginManager.addTextSearchAdapterType(
    () =>
      new TextSearchAdapterType({
        name: 'ApolloTextSearchAdapter',
        displayName: 'Apollo text search adapter',
        configSchema,
        AdapterClass: ApolloTextSearchAdapter,
        description: 'Apollo Text Search adapter',
      }),
  )
}
