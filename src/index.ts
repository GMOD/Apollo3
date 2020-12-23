import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AdapterClass as ApolloAdapterClass,
  configSchema as apolloAdapterConfigSchema,
} from './ApolloAdapter'
import ApolloWidget from './ApolloWidget'

import { isAbstractMenuManager, SessionWithWidgets } from '@jbrowse/core/util'

export default class ApolloPlugin extends Plugin {
  name = 'Apollo'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'ApolloAdapter',
          configSchema: apolloAdapterConfigSchema,
          AdapterClass: ApolloAdapterClass,
        }),
    )

    pluginManager.addWidgetType(() => {
      const { configSchema, ReactComponent, stateModel } = pluginManager.load(
        ApolloWidget,
      )

      return new WidgetType({
        name: 'ApolloWidget',
        heading: 'Apollo Stuff',
        configSchema,
        stateModel,
        ReactComponent,
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'Stuff',
        onClick: (session: SessionWithWidgets) => {
          const widget = session.addWidget('ApolloWidget', 'apolloWidget')
          session.showWidget(widget)
        },
      })
    }
  }
}
