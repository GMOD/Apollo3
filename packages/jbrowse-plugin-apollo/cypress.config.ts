import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import registerCodeCoverageTasks from '@cypress/code-coverage/task'
import { defineConfig } from 'cypress'
import getCompareSnapshotsPlugin from 'cypress-image-diff-js/plugin'
import { configurePlugin } from 'cypress-mongodb'

export default defineConfig({
  // Make viewport long and thin to avoid the scrollbar on the right interfere
  // with the coordinates
  viewportHeight: 2000,
  viewportWidth: 1300,
  retries: {
    runMode: 2,
  },
  env: {
    mongodb: {
      uri: 'mongodb://localhost:27017/?directConnection=true',
      database: 'apolloTestDb',
    },
  },
  expose: {
    // Coverage is collected when the plugin is built with COVERAGE=true
    coverage: process.env.COVERAGE === 'true',
    // A local-editing session (IndexedDB-backed, no collaboration server) is
    // served plain, with no login gate, by the "browse" static server -
    // unlike the collaboration-server-backed app at `baseUrl`, which always
    // requires a login.
    localAppUrl: 'http://localhost:8999',
  },
  // Only in CI, where they're uploaded as an artifact to help debug failures
  screenshotOnRunFailure: process.env.CI === 'true',
  video: false,
  e2e: {
    baseUrl: 'http://localhost:3999',
    setupNodeEvents(on, config) {
      // @ts-expect-error types are wrong
      getCompareSnapshotsPlugin(on, config)
      configurePlugin(on)
      registerCodeCoverageTasks(on, config)
      // Paths are relative to the project root. Tasks must return something
      // other than undefined, hence the nulls.
      const resolve = (file: string) => path.resolve(config.projectRoot, file)
      on('task', {
        readdirSync(folder: string) {
          return fs.readdirSync(folder)
        },
        copyFile({ source, target }: { source: string; target: string }) {
          fs.copyFileSync(resolve(source), resolve(target))
          return null
        },
        gzipFile({ source, target }: { source: string; target: string }) {
          fs.writeFileSync(
            resolve(target),
            zlib.gzipSync(fs.readFileSync(resolve(source))),
          )
          return null
        },
        /** Remove the files in `folder` whose names end with `suffix` */
        removeFiles({ folder, suffix }: { folder: string; suffix: string }) {
          if (!fs.existsSync(resolve(folder))) {
            return null
          }
          for (const file of fs.readdirSync(resolve(folder))) {
            if (file.endsWith(suffix)) {
              fs.rmSync(path.join(resolve(folder), file))
            }
          }
          return null
        },
        removeFile(file: string) {
          fs.rmSync(resolve(file), { force: true })
          return null
        },
      })
      return config
    },
  },
})
