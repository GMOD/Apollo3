/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { Writable } from 'node:stream'

import {
  ApolloPlugin,
  type ApolloPluginConstructor,
} from '@apollo-annotation/common'
import {
  type DynamicModule,
  Logger,
  Module,
  type Provider,
} from '@nestjs/common'
import sanitize from 'sanitize-filename'

import { APOLLO_PLUGINS } from './plugins.constants.js'
import { PluginsService } from './plugins.service.js'

@Module({})
export class PluginsModule {
  private readonly logger = new Logger(PluginsModule.name)

  static async registerAsync(): Promise<DynamicModule> {
    const { PLUGIN_URLS, PLUGIN_URLS_FILE } = process.env
    let pluginURLs = PLUGIN_URLS ? PLUGIN_URLS.split(',') : []
    if (pluginURLs.length === 0 && PLUGIN_URLS_FILE) {
      const pluginURLsFileText = await fsPromises.readFile(
        PLUGIN_URLS_FILE,
        'utf8',
      )
      pluginURLs = pluginURLsFileText
        .split(/\n|\r\n|\r/)
        .map((line) => line.trim())
    }

    const pluginsProvider: Provider = {
      provide: APOLLO_PLUGINS,
      useFactory: () => PluginsModule.fetchPlugins(pluginURLs),
    }

    return {
      module: PluginsModule,
      global: true,
      providers: [pluginsProvider, PluginsService],
      exports: [pluginsProvider, PluginsService],
    }
  }

  static async fetchPlugins(urls: string[]) {
    const plugins: ApolloPlugin[] = []
    for (const url of urls) {
      const tmpDir = await fsPromises.mkdtemp(
        path.join(__dirname, 'jbrowse-plugin-'),
      )
      let plugin: { default: ApolloPluginConstructor } | undefined
      try {
        const pluginLocation = path.join(tmpDir, sanitize(url))
        const pluginLocationRelative = `.${path.sep}${path.relative(
          __dirname,
          pluginLocation,
        )}`
        const file = Writable.toWeb(fs.createWriteStream(pluginLocation))
        const response = await fetch(url)
        if (!response.body) {
          throw new Error('fetch failed')
        }
        try {
          await response.body.pipeTo(file)
        } catch (error) {
          fs.unlinkSync(pluginLocation)
          console.error(error)
          throw error
        }
        plugin = await import(pluginLocationRelative)
      } finally {
        await fsPromises.rm(tmpDir, { recursive: true })
      }
      if (!plugin) {
        throw new Error(`Could not load plugin: ${url}`)
      }
      const PluginClass = plugin.default
      const runtimePlugin = new PluginClass()
      plugins.push(runtimePlugin)
    }
    return plugins
  }
}
