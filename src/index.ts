import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { runInAction } from 'mobx'
import {
  AdapterClass as ApolloAdapterClass,
  configSchema as apolloAdapterConfigSchema,
} from './ApolloAdapter'
import ApolloConnection from './ApolloConnection'
import {
  AdapterClass as ApolloSequenceAdapterClass,
  configSchema as apolloSequenceAdapterConfigSchema,
} from './ApolloSequenceAdapter'
import LinearApolloDisplay from './LinearApolloDisplay'
import LinearApolloReferenceSequenceDisplay from './LinearApolloReferenceSequenceDisplay'
import {
  configSchema as apolloFeatureDetailConfigSchema,
  ReactComponent as ApolloFeatureDetailReactComponent,
  stateModelFactory as ApolloFeatureDetailStateModelFactory,
} from './ApolloFeatureDetail'

export default class ApolloPlugin extends Plugin {
  name = 'Apollo'

  install(pluginManager: PluginManager) {
    pluginManager.addConnectionType(() => {
      const { configSchema, stateModel, getAssemblies } = pluginManager.load(
        ApolloConnection,
      )
      return new ConnectionType({
        name: 'ApolloConnection',
        configSchema,
        stateModel,
        getAssemblies,
        displayName: 'Apollo',
        description: 'An Apollo annotation server',
        url: '//genomearchitect.readthedocs.io/en/latest/UsersGuide.html',
      })
    })

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'ApolloAdapter',
          configSchema: apolloAdapterConfigSchema,
          AdapterClass: ApolloAdapterClass,
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'ApolloSequenceAdapter',
          configSchema: apolloSequenceAdapterConfigSchema,
          AdapterClass: ApolloSequenceAdapterClass,
        }),
    )

    const LGVPlugin = pluginManager.getPlugin(
      'LinearGenomeViewPlugin',
    ) as import('@jbrowse/plugin-linear-genome-view').default
    const { BaseLinearDisplayComponent } = LGVPlugin.exports

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

    pluginManager.addDisplayType(() => {
      const { configSchema, stateModel } = pluginManager.load(
        LinearApolloDisplay,
      )
      return new DisplayType({
        name: 'LinearApolloDisplay',
        configSchema,
        stateModel,
        trackType: 'ApolloTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })

    pluginManager.addDisplayType(() => {
      const { stateModel, configSchema } = pluginManager.load(
        LinearApolloReferenceSequenceDisplay,
      )
      return {
        name: 'LinearApolloReferenceSequenceDisplay',
        configSchema,
        stateModel,
        trackType: 'ReferenceSequenceTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      }
    })

    // to add the widget
    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'ApolloWidget',
          heading: 'Apollo Feature Details',
          configSchema: apolloFeatureDetailConfigSchema,
          stateModel: ApolloFeatureDetailStateModelFactory(pluginManager),
          ReactComponent: ApolloFeatureDetailReactComponent,
        }),
    )
  }

  configure(pluginManager: PluginManager) {
    const rootConfig = (pluginManager.rootModel?.jbrowse as {
      configuration: AnyConfigurationModel
    }).configuration
    if (!rootConfig) {
      return
    }
    const apolloConfigs = readConfObject(rootConfig, 'Apollo')
    runInAction(() => {
      for (const config of apolloConfigs) {
        // @ts-ignore
        pluginManager.rootModel?.jbrowse.addConnectionConf({
          type: 'ApolloConnection',
          connectionId: `ApolloConnection-${config.name}`,
          name: config.name,
          ephemeral: true,
          apolloConfig: config,
        })
      }
    })
  }
}
