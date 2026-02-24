/* eslint-disable @typescript-eslint/no-unsafe-argument */

import fs from 'node:fs'

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
  screenshotOnRunFailure: false,
  video: false,
  e2e: {
    baseUrl: 'http://localhost:8999',
    setupNodeEvents(on, config) {
      // @ts-expect-error types are wrong
      getCompareSnapshotsPlugin(on, config)
      configurePlugin(on)
      on('task', {
        readdirSync(path) {
          return fs.readdirSync(path)
        },
      })
      return config
    },
  },
})
