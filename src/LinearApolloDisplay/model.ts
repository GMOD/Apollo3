import { ConfigurationReference } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
// import { getSession } from '@jbrowse/core/util'
import {
  getParentRenderProps,
  // getRpcSessionId,
} from '@jbrowse/core/util/tracks'
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
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          config: self.configuration.renderer,
          username: sessionStorage.getItem('apolloUsername'),
          password: sessionStorage.getItem('apolloPassword'),
        }
      },

      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
}
