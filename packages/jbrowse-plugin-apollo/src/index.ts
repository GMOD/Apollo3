import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

import { version } from '../package.json'
import {
  ApolloView as ApolloViewReactComponent,
  stateModelFactory as apolloViewStateModelFactory,
} from './ApolloView'

export default class ApolloPlugin extends Plugin {
  name = 'ApolloPlugin'
  version = version

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'ApolloView',
        stateModel: apolloViewStateModelFactory(pluginManager),
        ReactComponent: ApolloViewReactComponent,
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Apollo View',
        onClick: (session: AbstractSessionModel) => {
          session.addView('ApolloView', {
            linearGenomeView: { type: 'LinearGenomeView' },
          })
        },
      })
    }
  }
}
