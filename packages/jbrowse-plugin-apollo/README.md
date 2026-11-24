# jbrowse-plugin-apollo

The Apollo client: a [JBrowse 2](https://jbrowse.org/jb2/) plugin for genome
annotation. See [apollo.jbrowse.org](https://apollo.jbrowse.org) for user
documentation, including how to load the plugin in JBrowse Web or JBrowse
Desktop.

## End-to-end tests with Cypress

The Cypress tests run against a local JBrowse with this plugin and a
collaboration server that uses the `apolloTestDb` MongoDB database. MongoDB must
be running on `localhost:27017`.

### Start the services

1. Install JBrowse into `.jbrowse/` (once, or when you want a different
   version). In VS Code run the `jbrowse: install version` task, or run:

   ```sh
   yarn workspace @apollo-annotation/jbrowse-plugin-apollo jbrowse create .jbrowse
   ```

2. Start everything the tests need. In VS Code run the `Start: e2e` task. It
   starts:

   - the collaboration server on port 3999 with `apolloTestDb` and guest users
     as admins (the same settings as the server's `cypress:start` script)
   - a server for the test data on port 3131
   - the plugin build in watch mode, served on port 9000
   - JBrowse, served from `.jbrowse/` on port 8999

   If you change the test database name, change it in `cypress.config.ts` too.

### Run the tests

Open the Cypress runner (or run the `cypress: open` task):

```sh
yarn workspace @apollo-annotation/jbrowse-plugin-apollo cypress open
```

Choose "E2E Testing", then a browser, then a spec from `cypress/e2e/`.

To run tests headless:

```sh
# All specs
yarn workspace @apollo-annotation/jbrowse-plugin-apollo cypress:run

# A single spec
yarn workspace @apollo-annotation/jbrowse-plugin-apollo cypress:run \
  --spec cypress/e2e/editFeature.cy.ts

# With screenshots and video on failure, and no retries
yarn workspace @apollo-annotation/jbrowse-plugin-apollo cypress:debug \
  --config retries=0 --spec cypress/e2e/editFeature.cy.ts
```

`yarn test:e2e` builds the plugin first and then runs all specs, as CI does.
