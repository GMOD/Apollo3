import { readConfObject } from '@jbrowse/core/configuration'
import { ConfigurationReference } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { configSchemaFactory } from './configSchema'

export function stateModelFactory(pluginManager: PluginManager) {
  const { types } = pluginManager.lib['mobx-state-tree']

  const configSchema = pluginManager.jbrequire(configSchemaFactory)

  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as import('@jbrowse/plugin-linear-genome-view').default
  const { BaseLinearDisplay } = LGVPlugin.exports

  return types
    .compose(
      'LinearApolloDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearApolloDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => ({
      get renderProps() {
        const apolloId = readConfObject(self.configuration, [
          'apolloConfig',
          'apolloId',
        ])
        const username = sessionStorage.getItem(`${apolloId}-apolloUsername`)
        const password = sessionStorage.getItem(`${apolloId}-apolloPassword`)
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          config: self.configuration.renderer,
          location: readConfObject(self.configuration, [
            'apolloConfig',
            'location',
          ]).uri,
          username,
          password,
        }
      },

      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
}
