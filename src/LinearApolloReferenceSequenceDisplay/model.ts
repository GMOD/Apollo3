import { ConfigurationReference } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { configSchemaFactory } from './configSchema'

export function stateModelFactory(pluginManager: PluginManager) {
  const { types } = pluginManager.lib['mobx-state-tree']

  const configSchema = pluginManager.jbrequire(configSchemaFactory)

  const SequencePlugin = pluginManager.getPlugin(
    'SequencePlugin',
  ) as import('@jbrowse/plugin-sequence').default
  // @ts-ignore
  const { linearReferenceSequenceDisplayModelFactory } = SequencePlugin.exports
  const BaseRefSeqDisplayModel = linearReferenceSequenceDisplayModelFactory(
    configSchema,
  )

  return types
    .compose(
      'LinearApolloReferenceSequenceDisplay',
      BaseRefSeqDisplayModel,
      types.model({
        type: types.literal('LinearApolloReferenceSequenceDisplay'),
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
