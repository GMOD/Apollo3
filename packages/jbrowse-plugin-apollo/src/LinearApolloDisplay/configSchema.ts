import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

export function configSchemaFactory(pluginManager: PluginManager) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { baseLinearDisplayConfigSchema } = LGVPlugin.exports

  return ConfigurationSchema(
    'LinearApolloDisplay',
    { height: { type: 'number', defaultValue: 500 } },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}
