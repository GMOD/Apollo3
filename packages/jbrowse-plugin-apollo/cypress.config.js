// eslint-disable-next-line @typescript-eslint/no-var-requires
const { defineConfig } = require('cypress')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { configurePlugin } = require('cypress-mongodb')

module.exports = defineConfig({
  // Make viewport long and thin to avoid the scrollbar on the right intefere
  // with the coordinates
  viewportHeight: 2000,
  viewportWidth: 1000,
  env: {
    mongodb: {
      uri: 'mongodb://localhost:27017/?directConnection=true',
      database: 'apolloTestDb',
    },
  },
  e2e: {
    setupNodeEvents(on, _config) {
      configurePlugin(on)
    },
  },
})
