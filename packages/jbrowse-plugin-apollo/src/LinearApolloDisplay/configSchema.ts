import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

import { configSchema as apolloRendererConfigSchema } from '../ApolloRenderer'

export function configSchemaFactory(pluginManager: PluginManager) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as import('@jbrowse/plugin-linear-genome-view').default
  const { baseLinearDisplayConfigSchema } = LGVPlugin.exports

  return ConfigurationSchema(
    'LinearApolloDisplay',
    { renderer: apolloRendererConfigSchema },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}
