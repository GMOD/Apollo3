import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'

export type ApolloPluginConstructor = new (...args: unknown[]) => ApolloPlugin

export interface ApolloPluginManager {
  addToExtensionPoint: PluginManager['addToExtensionPoint']
}

export abstract class ApolloPlugin extends Plugin {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  apolloInstall(pluginManager: ApolloPluginManager): void {}
}
