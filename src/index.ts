import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { runInAction } from 'mobx'
import ApolloConnection from './ApolloConnection'
import {
  AdapterClass as ApolloSequenceAdapterClass,
  configSchema as apolloSequenceAdapterConfigSchema,
} from './ApolloSequenceAdapter'
import LinearApolloReferenceSequenceDisplay from './LinearApolloReferenceSequenceDisplay'

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
          name: 'ApolloSequenceAdapter',
          configSchema: apolloSequenceAdapterConfigSchema,
          AdapterClass: ApolloSequenceAdapterClass,
        }),
    )

    const LGVPlugin = pluginManager.getPlugin(
      'LinearGenomeViewPlugin',
    ) as import('@jbrowse/plugin-linear-genome-view').default
    const { BaseLinearDisplayComponent } = LGVPlugin.exports

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
