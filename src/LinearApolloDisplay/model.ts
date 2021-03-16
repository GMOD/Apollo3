import { readConfObject } from '@jbrowse/core/configuration'
import { ConfigurationReference } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { configSchemaFactory } from './configSchema'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import {
  getSession,
  isSessionModelWithWidgets,
  getContainingView,
} from '@jbrowse/core/util'

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
    .actions(self => ({
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'ApolloWidget',
            'apolloWidget',
            {
              featureData: feature.toJSON(),
              view: getContainingView(self),
              apolloUrl: readConfObject(self.configuration, [
                'apolloConfig',
                'location',
              ]).uri,
              apolloId: readConfObject(self.configuration, [
                'apolloConfig',
                'apolloId',
              ]),
            },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(feature)
      },
    }))
}
