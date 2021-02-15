import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export function configSchemaFactory(pluginManager: PluginManager) {
  const SequencePlugin = pluginManager.getPlugin(
    'SequencePlugin',
  ) as import('@jbrowse/plugin-sequence').default
  // @ts-ignore
  const { linearReferenceSequenceDisplayConfigSchema } = SequencePlugin.exports

  return ConfigurationSchema(
    'LinearApolloReferenceSequenceDisplay',
    {},
    {
      baseConfiguration: linearReferenceSequenceDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
