/**
 * Builds the server half as one self-contained ES module, for loading with
 * `PLUGIN_URLS` (e.g. into the published Docker image, where
 * `PLUGIN_PACKAGES` can't add new packages).
 *
 * A bundle loaded from a URL can only import packages that the collaboration
 * server lists in its own production `dependencies`, so only those are left
 * external (and shared with the server). Everything else, including this
 * plugin's own `../shared` code and any other third-party package, is bundled.
 */
import { defineConfig } from 'rolldown'

const serverProvided = ['@apollo-annotation/common', 'mongoose']

export default defineConfig({
  input: 'src/server/index.ts',
  platform: 'node',
  external: (id) =>
    serverProvided.some((name) => id === name || id.startsWith(`${name}/`)),
  output: {
    file: 'dist/server.bundle.js',
    format: 'esm',
    sourcemap: true,
  },
})
