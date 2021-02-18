import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ApolloConfigurationSchema } from '../globalConfigSchema'

export function configSchemaFactory(pluginManager: PluginManager) {
  const SequencePlugin = pluginManager.getPlugin(
    'SequencePlugin',
  ) as import('@jbrowse/plugin-sequence').default
  const { linearReferenceSequenceDisplayConfigSchema } = SequencePlugin.exports

  return ConfigurationSchema(
    'LinearApolloReferenceSequenceDisplay',
    { apolloConfig: ApolloConfigurationSchema },
    {
      baseConfiguration: linearReferenceSequenceDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
