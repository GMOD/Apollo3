import { readConfObject } from '@jbrowse/core/configuration'
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
