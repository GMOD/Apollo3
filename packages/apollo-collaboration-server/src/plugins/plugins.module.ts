import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'

import { DynamicModule, Logger, Module, Provider } from '@nestjs/common'
import { ApolloPlugin, ApolloPluginConstructor } from 'apollo-common'
import fetch from 'node-fetch'
import sanitize from 'sanitize-filename'

import { APOLLO_PLUGINS } from './plugins.constants'
import { PluginsService } from './plugins.service'

@Module({})
export class PluginsModule {
  private readonly logger = new Logger(PluginsModule.name)

  static async registerAsync(): Promise<DynamicModule> {
    const { PLUGIN_URLS, PLUGIN_URLS_FILE } = process.env
    let pluginURLs = PLUGIN_URLS ? PLUGIN_URLS.split(',') : []
    if (!pluginURLs.length) {
      if (PLUGIN_URLS_FILE) {
        const pluginURLsFileText = await fsPromises.readFile(
          PLUGIN_URLS_FILE,
          'utf-8',
        )
        pluginURLs = pluginURLsFileText
          .split(/\n|\r\n|\r/)
          .map((line) => line.trim())
      }
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
      let plugin: { default: ApolloPluginConstructor } | undefined = undefined
      try {
        const pluginLocation = path.join(tmpDir, sanitize(url))
        const pluginLocationRelative = `.${path.sep}${path.relative(
          __dirname,
          pluginLocation,
        )}`
        await new Promise((resolve, reject) => {
          const file = fs.createWriteStream(pluginLocation)
          fetch(url)
            .then((response) => {
              if (!response.body) {
                return reject('fetch failed')
              }
              response.body.pipe(file)
              file.on('finish', resolve)
              file.on('error', (err) => {
                fs.unlinkSync(pluginLocation)
                reject(err)
              })
            })
            .catch((err) => {
              console.error(err)
              throw err
            })
        })
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
