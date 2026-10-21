import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { ApolloServerPlugin } from '@apollo-annotation/common'
import { jest } from '@jest/globals'
import type { FactoryProvider } from '@nestjs/common'

import { APOLLO_PLUGINS } from './plugins.constants.js'
import { PluginsModule } from './plugins.module.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, '__fixtures__')

async function loadPlugins(): Promise<ApolloServerPlugin[]> {
  const dynamicModule = await PluginsModule.registerAsync()
  const pluginsProvider = dynamicModule.providers?.find(
    (provider): provider is FactoryProvider =>
      typeof provider === 'object' &&
      'provide' in provider &&
      provider.provide === APOLLO_PLUGINS,
  )
  if (!pluginsProvider) {
    throw new Error('APOLLO_PLUGINS provider not found')
  }
  return pluginsProvider.useFactory() as Promise<ApolloServerPlugin[]>
}

/** Asserts and returns the single plugin loaded, for tests that expect one. */
async function loadSinglePlugin(): Promise<ApolloServerPlugin> {
  const plugins = await loadPlugins()
  expect(plugins).toHaveLength(1)
  const [plugin] = plugins
  if (!plugin) {
    throw new Error('expected a plugin')
  }
  return plugin
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

async function mockFetchReturning(fixtureFile: string) {
  const bytes = await fsPromises.readFile(path.join(FIXTURES_DIR, fixtureFile))
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {},
    arrayBuffer: () => Promise.resolve(toArrayBuffer(bytes)),
  } as unknown as Response)
  return bytes
}

describe('PluginsModule', () => {
  const originalEnv = { ...process.env }
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await fsPromises.mkdtemp(
      path.join(os.tmpdir(), 'apollo-plugin-cache-test-'),
    )
    process.env.PLUGIN_CACHE_DIR = cacheDir
    delete process.env.PLUGIN_PACKAGES
    delete process.env.PLUGIN_URLS
    delete process.env.PLUGIN_URLS_FILE
    delete process.env.PLUGIN_INTEGRITY
  })

  afterEach(async () => {
    process.env = { ...originalEnv }
    await fsPromises.rm(cacheDir, { recursive: true, force: true })
    jest.restoreAllMocks()
  })

  it('resolves to no plugins when nothing is configured', async () => {
    const plugins = await loadPlugins()
    expect(plugins).toEqual([])
  })

  describe('PLUGIN_PACKAGES', () => {
    it('loads a valid plugin', async () => {
      // A bare npm specifier is resolved via node_modules in production; a
      // file:// URL exercises the same `import(specifier)` call with a
      // specifier this test can control without adding a real dependency.
      process.env.PLUGIN_PACKAGES = pathToFileURL(
        path.join(FIXTURES_DIR, 'valid-plugin.mjs'),
      ).href

      const plugin = await loadSinglePlugin()

      expect(plugin.name).toBe('ValidPlugin')
      expect(typeof plugin.install).toBe('function')
    })

    it('rejects a module with no default export', async () => {
      process.env.PLUGIN_PACKAGES = pathToFileURL(
        path.join(FIXTURES_DIR, 'no-default-export.mjs'),
      ).href

      await expect(loadPlugins()).rejects.toThrow(/has no default export/)
    })

    it('rejects a default export missing install()/name', async () => {
      process.env.PLUGIN_PACKAGES = pathToFileURL(
        path.join(FIXTURES_DIR, 'invalid-plugin.mjs'),
      ).href

      await expect(loadPlugins()).rejects.toThrow(
        /does not implement ApolloServerPlugin/,
      )
    })

    it('rejects a specifier that cannot be imported at all', async () => {
      process.env.PLUGIN_PACKAGES = 'this-package-does-not-exist-anywhere'

      await expect(loadPlugins()).rejects.toThrow(
        /Could not import plugin package/,
      )
    })
  })

  describe('PLUGIN_URLS', () => {
    it('fetches and loads a valid plugin bundle', async () => {
      await mockFetchReturning('valid-plugin.mjs')
      process.env.PLUGIN_URLS = 'https://example.com/valid-plugin.mjs'

      const plugin = await loadSinglePlugin()

      expect(plugin.name).toBe('ValidPlugin')
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    it('caches the fetched bundle by content hash', async () => {
      await mockFetchReturning('valid-plugin.mjs')
      process.env.PLUGIN_URLS = 'https://example.com/valid-plugin.mjs'

      await loadPlugins()

      const cachedFiles = await fsPromises.readdir(cacheDir)
      expect(cachedFiles).toHaveLength(1)
      expect(cachedFiles[0]).toMatch(/^[0-9a-f]{64}\.mjs$/)
    })

    it('rejects when the response is not ok', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        body: null,
      } as unknown as Response)
      process.env.PLUGIN_URLS = 'https://example.com/missing-plugin.mjs'

      await expect(loadPlugins()).rejects.toThrow(/Could not fetch plugin/)
    })

    it('rejects when the fetched content does not match PLUGIN_INTEGRITY', async () => {
      await mockFetchReturning('valid-plugin.mjs')
      process.env.PLUGIN_URLS = 'https://example.com/valid-plugin.mjs'
      process.env.PLUGIN_INTEGRITY =
        'https://example.com/valid-plugin.mjs=0000000000000000000000000000000000000000000000000000000000000000'

      await expect(loadPlugins()).rejects.toThrow(
        /does not match the configured integrity hash/,
      )
    })

    it('skips the network entirely when a matching integrity hash is already cached', async () => {
      const bytes = await mockFetchReturning('valid-plugin.mjs')
      const { default: crypto } = await import('node:crypto')
      const hash = crypto.createHash('sha256').update(bytes).digest('hex')
      await fsPromises.writeFile(path.join(cacheDir, `${hash}.mjs`), bytes)

      process.env.PLUGIN_URLS = 'https://example.com/valid-plugin.mjs'
      process.env.PLUGIN_INTEGRITY = `https://example.com/valid-plugin.mjs=${hash}`

      const plugin = await loadSinglePlugin()

      expect(plugin.name).toBe('ValidPlugin')
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('rejects a fetched file that fails to evaluate as a module', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: {},
        arrayBuffer: () =>
          Promise.resolve(
            toArrayBuffer(
              new TextEncoder().encode(
                "throw new Error('this module fails to evaluate')",
              ),
            ),
          ),
      } as unknown as Response)
      process.env.PLUGIN_URLS = 'https://example.com/broken-plugin.mjs'

      await expect(loadPlugins()).rejects.toThrow(
        /Server plugins must be a Node-targeted ESM\/CJS build/,
      )
    })
  })

  it('loads plugins from both PLUGIN_PACKAGES and PLUGIN_URLS together', async () => {
    process.env.PLUGIN_PACKAGES = pathToFileURL(
      path.join(FIXTURES_DIR, 'valid-plugin.mjs'),
    ).href
    await mockFetchReturning('valid-plugin.mjs')
    process.env.PLUGIN_URLS = 'https://example.com/valid-plugin.mjs'

    const plugins = await loadPlugins()

    expect(plugins).toHaveLength(2)
    expect(plugins.every((plugin) => plugin.name === 'ValidPlugin')).toBe(true)
  })
})
