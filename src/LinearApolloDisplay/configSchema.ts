import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export function configSchemaFactory(pluginManager: PluginManager) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as import('@jbrowse/plugin-linear-genome-view').default
  const { baseLinearDisplayConfigSchema } = LGVPlugin.exports
  const ApolloRendererConfigSchema = pluginManager.getRendererType(
    'ApolloRenderer',
  ).configSchema

  return ConfigurationSchema(
    'LinearApolloDisplay',
    { renderer: ApolloRendererConfigSchema },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}
