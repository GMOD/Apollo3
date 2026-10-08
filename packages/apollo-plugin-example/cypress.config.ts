import { defineConfig } from 'cypress'
import { configurePlugin } from 'cypress-mongodb'

// Expects these to be running (see "End-to-end tests" in README.md):
// - MongoDB (a replica set) on 27017
// - the collaboration server on 3999, started with `cypress:start:example`
// - the Apollo JBrowse plugin's `start:server` (9000) and `browse` (8999)
// - this package's `serve:dist` (3838)
export default defineConfig({
  viewportHeight: 2000,
  viewportWidth: 1300,
  retries: {
    runMode: 2,
  },
  env: {
    mongodb: {
      uri: 'mongodb://localhost:27017/?directConnection=true',
      database: 'apolloExampleTestDb',
    },
  },
  screenshotOnRunFailure: false,
  video: false,
  e2e: {
    baseUrl: 'http://localhost:8999',
    setupNodeEvents(on, config) {
      configurePlugin(on)
      return config
    },
  },
})
