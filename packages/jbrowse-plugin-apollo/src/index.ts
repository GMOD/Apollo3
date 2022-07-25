import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DisplayType,
  InternetAccountType,
  TrackType,
  ViewType,
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import {
  AddAssemblyFromFileChange,
  AddFeaturesFromFileChange,
  LocationEndChange,
  LocationStartChange,
  TypeChange,
  changeRegistry,
} from 'apollo-shared'

import { version } from '../package.json'
import {
  ApolloDetailsView as ApolloDetailsViewReactComponent,
  stateModelFactory as apolloDetailsViewStateModelFactory,
} from './ApolloDetailsView'
import {
  configSchema as apolloInternetAccountConfigSchema,
  modelFactory as apolloInternetAccountModelFactory,
} from './ApolloInternetAccount'
import {
  ApolloRenderer,
  ReactComponent as ApolloRendererReactComponent,
  configSchema as apolloRendererConfigSchema,
} from './ApolloRenderer'
import {
  ApolloView as ApolloViewReactComponent,
  stateModelFactory as apolloViewStateModelFactory,
} from './ApolloView'
import { AddAssembly, ImportFeatures } from './components'
import {
  stateModelFactory as LinearApolloDisplayStateModelFactory,
  configSchemaFactory as linearApolloDisplayConfigSchemaFactory,
} from './LinearApolloDisplay'
import { makeDisplayComponent } from './makeDisplayComponent'

changeRegistry.registerChange(
  'AddAssemblyFromFileChange',
  AddAssemblyFromFileChange,
)
changeRegistry.registerChange(
  'AddFeaturesFromFileChange',
  AddFeaturesFromFileChange,
)
changeRegistry.registerChange('LocationEndChange', LocationEndChange)
changeRegistry.registerChange('LocationStartChange', LocationStartChange)
changeRegistry.registerChange('TypeChange', TypeChange)

export default class ApolloPlugin extends Plugin {
  name = 'ApolloPlugin'
  version = version

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'ApolloDetailsView',
        stateModel: apolloDetailsViewStateModelFactory(pluginManager),
        ReactComponent: ApolloDetailsViewReactComponent,
      })
    })

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
        { adapter: '' },
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

    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        name: 'ApolloInternetAccount',
        configSchema: apolloInternetAccountConfigSchema,
        stateModel: apolloInternetAccountModelFactory(
          apolloInternetAccountConfigSchema,
        ),
      })
    })

    pluginManager.addDisplayType(() => {
      const configSchema = linearApolloDisplayConfigSchemaFactory(pluginManager)
      const DisplayComponent = makeDisplayComponent(pluginManager)
      return new DisplayType({
        name: 'LinearApolloDisplay',
        configSchema,
        stateModel: LinearApolloDisplayStateModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'ApolloTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: DisplayComponent,
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
      pluginManager.rootModel.insertMenu('Apollo', -1)
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Add Apollo View',
        onClick: (session: AbstractSessionModel) => {
          session.addView('ApolloView', {})
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Add Assembly',
        onClick: (session: AbstractSessionModel) => {
          session.queueDialog((doneCallback) => [
            AddAssembly,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
            },
          ])
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Import Features',
        onClick: (session: AbstractSessionModel) => {
          session.queueDialog((doneCallback) => [
            ImportFeatures,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
            },
          ])
        },
      })
    }
  }
}
