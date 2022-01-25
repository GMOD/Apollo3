import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

import { version } from '../package.json'
import {
  ApolloRenderer,
  ReactComponent as ApolloRendererReactComponent,
  configSchema as apolloRendererConfigSchema,
} from './ApolloRenderer'
import {
  ApolloView as ApolloViewReactComponent,
  stateModelFactory as apolloViewStateModelFactory,
} from './ApolloView'
import { changeRegistry } from './ChangeManager/ChangeTypes'
import { LocationEndChange } from './ChangeManager/LocationEndChange'
import {
  stateModelFactory as LinearApolloDisplayStateModelFactory,
  configSchemaFactory as linearApolloDisplayConfigSchemaFactory,
} from './LinearApolloDisplay'

changeRegistry.registerChange('LocationEndChange', LocationEndChange)

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

    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'ApolloTrack',
        {},
        {
          baseConfiguration: createBaseTrackConfig(pluginManager),
          explicitIdentifier: 'trackId',
        },
      )
      return new TrackType({
        name: 'ApolloTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'ApolloTrack',
          configSchema,
        ),
      })
    })

    const LGVPlugin = pluginManager.getPlugin(
      'LinearGenomeViewPlugin',
    ) as import('@jbrowse/plugin-linear-genome-view').default
    const { BaseLinearDisplayComponent } = LGVPlugin.exports
    pluginManager.addDisplayType(() => {
      const configSchema = linearApolloDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearApolloDisplay',
        configSchema,
        stateModel: LinearApolloDisplayStateModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'ApolloTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })

    pluginManager.addRendererType(
      () =>
        new ApolloRenderer({
          name: 'ApolloRenderer',
          ReactComponent: ApolloRendererReactComponent,
          configSchema: apolloRendererConfigSchema,
          pluginManager,
        }),
    )
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
