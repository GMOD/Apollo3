import type PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import { ApolloSequenceAdapter } from './ApolloSequenceAdapter'
import configSchema from './configSchema'

export function installApolloSequenceAdapter(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'ApolloSequenceAdapter',
        configSchema,
        adapterMetadata: {
          category: undefined,
          hiddenFromGUI: true,
          description: undefined,
        },
        AdapterClass: ApolloSequenceAdapter,
      }),
  )
}
