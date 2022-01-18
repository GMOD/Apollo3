import InternetAccountType from '@jbrowse/core/pluggableElementTypes/InternetAccountType'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  SessionWithWidgets,
  isAbstractMenuManager,
} from '@jbrowse/core/util'

import { version } from '../package.json'
import ApolloAuthWidgetF from './ApolloAuthWidget'
import {
  configSchema as ApolloConfigSchema,
  modelFactory as ApolloInternetAccountModelFactory,
} from './ApolloInternetAccount'
import {
  ReactComponent as HelloViewReactComponent,
  stateModel as helloViewStateModel,
} from './HelloView'

export default class ApolloPlugin extends Plugin {
  name = 'ApolloPlugin'
  version = version

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'HelloView',
        stateModel: helloViewStateModel,
        ReactComponent: HelloViewReactComponent,
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'ApolloAuthWidget',
        heading: 'Auth',
        ...ApolloAuthWidgetF(pluginManager),
      })
    })

    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        name: 'ApolloInternetAccount',
        configSchema: ApolloConfigSchema,
        stateModel: ApolloInternetAccountModelFactory(ApolloConfigSchema),
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Hello View',
        onClick: (session: AbstractSessionModel) => {
          session.addView('HelloView', {})
        },
      })

      pluginManager.rootModel.appendToMenu('Auth', {
        label: 'Open Apollo Auth',
        onClick: (session: SessionWithWidgets) => {
          const authWidget = session.addWidget(
            'ApolloAuthWidget',
            'apolloAuthWidget',
          )
          session.showWidget(authWidget)
        },
      })
    }
  }
}
