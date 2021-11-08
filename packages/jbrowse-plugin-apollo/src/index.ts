import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import { version } from '../package.json'
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
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Hello View',
        onClick: (session: AbstractSessionModel) => {
          session.addView('HelloView', {})
        },
      })
    }
  }
}
