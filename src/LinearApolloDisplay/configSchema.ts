import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ApolloConfigurationSchema } from '../globalConfigSchema'

export function configSchemaFactory(pluginManager: PluginManager) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as import('@jbrowse/plugin-linear-genome-view').default
  const { baseLinearDisplayConfigSchema } = LGVPlugin.exports
  const SvgFetureRendererConfigSchema = pluginManager.getRendererType(
    'SvgFeatureRenderer',
  ).configSchema

  return ConfigurationSchema(
    'LinearApolloDisplay',
    {
      renderer: SvgFetureRendererConfigSchema,
      apolloConfig: ApolloConfigurationSchema,
    },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}
