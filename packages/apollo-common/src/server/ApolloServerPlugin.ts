import type { ApolloServerHookRegistrar } from './ApolloServerHooks.js'

export type ApolloServerPluginConstructor = new (
  ...args: unknown[]
) => ApolloServerPlugin

/**
 * A server-side Apollo plugin. Unlike a client-side (JBrowse) plugin, this has
 * no relationship to `@jbrowse/core`'s `Plugin` class: it is a plain, Node-only
 * contract, shipped as either an npm package (`PLUGIN_PACKAGES`) or a
 * Node-targeted ESM/CJS bundle fetched from a URL (`PLUGIN_URLS`/
 * `PLUGIN_URLS_FILE`) — never a browser/UMD bundle.
 *
 * A plugin that also has a client-side half (e.g. a custom login button to go
 * with a server-side auth handler) should ship it as a second, separately
 * built artifact from the same source package, rather than one physical
 * bundle loaded into both runtimes.
 */
export abstract class ApolloServerPlugin {
  abstract name: string

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  install(_registrar: ApolloServerHookRegistrar): void | Promise<void> {}
}
