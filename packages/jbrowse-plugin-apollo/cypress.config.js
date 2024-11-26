/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

const { defineConfig } = require('cypress')

const { configurePlugin } = require('cypress-mongodb')

const fs = require('node:fs')

module.exports = defineConfig({
  // Make viewport long and thin to avoid the scrollbar on the right interfere
  // with the coordinates
  viewportHeight: 2000,
  viewportWidth: 1000,
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
