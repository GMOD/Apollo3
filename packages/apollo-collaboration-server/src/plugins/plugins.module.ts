import crypto from 'node:crypto'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type {
  ApolloServerPlugin,
  ApolloServerPluginConstructor,
} from '@apollo-annotation/common'
import {
  type DynamicModule,
  Logger,
  Module,
  type Provider,
} from '@nestjs/common'

import { APOLLO_PLUGINS } from './plugins.constants.js'
import { PluginsService } from './plugins.service.js'
import { PluginRoutesController } from './pluginRoutes.controller.js'

/**
 * Thrown when a configured plugin package/URL doesn't resolve to a valid
 * `ApolloServerPlugin` — e.g. it's a client-only JBrowse plugin bundle, a
 * browser/UMD build, or is simply missing.
 */
export class InvalidApolloServerPluginError extends Error {}

const logger = new Logger('PluginsModule')

@Module({})
export class PluginsModule {
  static async registerAsync(): Promise<DynamicModule> {
    const { PLUGIN_PACKAGES, PLUGIN_URLS, PLUGIN_URLS_FILE } = process.env
    const pluginPackages = PLUGIN_PACKAGES
      ? PLUGIN_PACKAGES.split(',').map((entry) => entry.trim())
      : []
    let pluginURLs = PLUGIN_URLS ? PLUGIN_URLS.split(',') : []
    if (pluginURLs.length === 0 && PLUGIN_URLS_FILE) {
      const pluginURLsFileText = await fsPromises.readFile(
        PLUGIN_URLS_FILE,
        'utf8',
      )
      pluginURLs = pluginURLsFileText
        .split(/\n|\r\n|\r/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    }

    const pluginsProvider: Provider = {
      provide: APOLLO_PLUGINS,
      useFactory: () => PluginsModule.loadPlugins(pluginPackages, pluginURLs),
    }

    return {
      module: PluginsModule,
      global: true,
      controllers: [PluginRoutesController],
      providers: [pluginsProvider, PluginsService],
      exports: [pluginsProvider, PluginsService],
    }
  }

  private static async loadPlugins(
    pluginPackages: string[],
    pluginURLs: string[],
  ): Promise<ApolloServerPlugin[]> {
    const plugins: ApolloServerPlugin[] = []
    for (const specifier of pluginPackages) {
      plugins.push(await PluginsModule.loadPackagePlugin(specifier))
    }
    for (const url of pluginURLs) {
      plugins.push(await PluginsModule.loadUrlPlugin(url))
    }
    return plugins
  }

  /**
   * Loads a plugin from the server's own `node_modules`/lockfile — no
   * network fetch, no temp files, no hash-checking, since npm's lockfile
   * already gives integrity and reproducibility. This is the recommended
   * path for self-hosted operators who control their own server image.
   */
  private static async loadPackagePlugin(
    specifier: string,
  ): Promise<ApolloServerPlugin> {
    let imported: { default?: ApolloServerPluginConstructor }
    try {
      imported = (await import(specifier)) as {
        default?: ApolloServerPluginConstructor
      }
    } catch (error) {
      throw new InvalidApolloServerPluginError(
        `Could not import plugin package "${specifier}": ${String(error)}`,
      )
    }
    return PluginsModule.instantiate(imported, specifier)
  }

  /**
   * Fetches a plugin bundle from a URL, for "point at a URL, no rebuild"
   * ergonomics (e.g. hosted/managed deployments). The bundle must be a
   * Node-targeted ESM/CJS build, not a browser/UMD bundle.
   *
   * Fetched bytes are cached by content hash under `PLUGIN_CACHE_DIR` (an OS
   * cache dir by default). If an integrity hash for this URL is configured
   * (`PLUGIN_INTEGRITY`) and already cached, the network is skipped entirely.
   * Without a configured hash, the content isn't known until after fetching,
   * so the URL is always requested, but the cache still avoids rewriting an
   * unchanged file to disk.
   */
  private static async loadUrlPlugin(url: string): Promise<ApolloServerPlugin> {
    const cacheDir =
      process.env.PLUGIN_CACHE_DIR ??
      path.join(os.tmpdir(), 'apollo-plugin-cache')
    await fsPromises.mkdir(cacheDir, { recursive: true })

    const expectedIntegrity = PluginsModule.getExpectedIntegrity(url)
    if (expectedIntegrity) {
      const cachedFile = path.join(cacheDir, `${expectedIntegrity}.mjs`)
      try {
        await fsPromises.access(cachedFile)
        logger.log(
          `Using cached copy of plugin "${url}" (sha256:${expectedIntegrity}), skipping fetch`,
        )
        return await PluginsModule.importPluginFile(cachedFile, url)
      } catch (error) {
        if (error instanceof InvalidApolloServerPluginError) {
          throw error
        }
        // Not cached yet - fall through to fetch it.
      }
    }

    let response: Response
    try {
      response = await fetch(url)
    } catch (error) {
      throw new InvalidApolloServerPluginError(
        `Could not fetch plugin from "${url}": ${String(error)}`,
      )
    }
    if (!response.ok || !response.body) {
      throw new InvalidApolloServerPluginError(
        `Could not fetch plugin from "${url}": ${response.status} ${response.statusText}`,
      )
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    const hash = crypto.createHash('sha256').update(bytes).digest('hex')

    if (expectedIntegrity && expectedIntegrity !== hash) {
      throw new InvalidApolloServerPluginError(
        `Plugin at "${url}" does not match the configured integrity hash (expected ${expectedIntegrity}, got ${hash})`,
      )
    }

    const cachedFile = path.join(cacheDir, `${hash}.mjs`)
    try {
      await fsPromises.access(cachedFile)
    } catch {
      await fsPromises.writeFile(cachedFile, bytes)
    }

    return PluginsModule.importPluginFile(cachedFile, url)
  }

  private static async importPluginFile(
    filePath: string,
    source: string,
  ): Promise<ApolloServerPlugin> {
    let imported: { default?: ApolloServerPluginConstructor }
    try {
      imported = (await import(pathToFileURL(filePath).href)) as {
        default?: ApolloServerPluginConstructor
      }
    } catch (error) {
      throw new InvalidApolloServerPluginError(
        `Could not load plugin from "${source}" as a Node ES module. Server plugins must be a Node-targeted ESM/CJS build, not a browser/UMD bundle. Original error: ${String(error)}`,
      )
    }
    return PluginsModule.instantiate(imported, source)
  }

  private static getExpectedIntegrity(url: string): string | undefined {
    const raw = process.env.PLUGIN_INTEGRITY
    if (!raw) {
      return undefined
    }
    for (const entry of raw.split(',')) {
      const [entryUrl, hash] = entry.split('=')
      if (entryUrl === url) {
        return hash
      }
    }
    return undefined
  }

  private static instantiate(
    imported: { default?: ApolloServerPluginConstructor },
    source: string,
  ): ApolloServerPlugin {
    const PluginClass = imported.default
    if (typeof PluginClass !== 'function') {
      throw new InvalidApolloServerPluginError(
        `Plugin "${source}" has no default export, or its default export is not a class`,
      )
    }
    const instance = new PluginClass()
    if (typeof instance.install !== 'function' || !instance.name) {
      throw new InvalidApolloServerPluginError(
        `Plugin "${source}"'s default export does not implement ApolloServerPlugin (missing an "install" method or a "name")`,
      )
    }
    return instance
  }
}
