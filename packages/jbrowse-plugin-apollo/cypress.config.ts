/* eslint-disable @typescript-eslint/no-unsafe-argument */

import fs from 'node:fs'

// @ts-expect-error no types available
import codeCoverageTask from '@cypress/code-coverage/task'
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
    // Coverage is collected when the plugin is built with COVERAGE=true
    coverage: process.env.COVERAGE === 'true',
  },
  screenshotOnRunFailure: false,
  video: false,
  e2e: {
    baseUrl: 'http://localhost:8999',
    setupNodeEvents(on, config) {
      // @ts-expect-error types are wrong
      getCompareSnapshotsPlugin(on, config)
      configurePlugin(on)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      codeCoverageTask(on, config)
      on('task', {
        readdirSync(path) {
          return fs.readdirSync(path)
        },
      })
      return config
    },
  },
})
