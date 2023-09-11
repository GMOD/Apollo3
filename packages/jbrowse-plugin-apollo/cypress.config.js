// eslint-disable-next-line @typescript-eslint/no-var-requires
const { defineConfig } = require('cypress')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { configurePlugin } = require('cypress-mongodb')

module.exports = defineConfig({
  env: {
    mongodb: {
      uri: 'mongodb://localhost:27017',
      database: 'database_name',
      collection: 'collection_name',
    },
  },
  e2e: {
    setupNodeEvents(on, config) {
      configurePlugin(on)
    },
  },
})

// module.exports = {
//   e2e: {
//     setupNodeEvents(_on, _config) {
//       // implement node event listeners here
//     },
//   },
// }
