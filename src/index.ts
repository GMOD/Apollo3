import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { apolloFetch } from './apolloFetch'

export default class ApolloPlugin extends Plugin {
  name = 'Apollo'

  configure(pluginManager: PluginManager) {
    const rootConfig = (pluginManager.rootModel?.jbrowse as {
      configuration: AnyConfigurationModel
    }).configuration
    const apolloConfigs = readConfObject(rootConfig, 'Apollo')
    for (const config of apolloConfigs) {
      apolloFetch(config, 'user/checkLogin')
    }
  }
}
