# jbrowse-plugin-apollo

## Testing with cypress

These notes setup cypress and run tests. These notes are likely to change.

- One time step: **Outside** the Apollo dev container
  [install cypress](https://docs.cypress.io/guides/getting-started/installing-cypress).
  E.g. on your OS terminal (not vscode) run:

```
yarn --cwd packages/jbrowse-plugin-apollo add cypress --dev
yarn --cwd packages/jbrowse-plugin-apollo add cypress-mongodb --dev
```

Add these lines to the `packageExtensions` section of `.yarnrc.yml`:

```
  cypress-mongodb@*:
    dependencies:
      bson: "*"
```

Then run `yarn` again.

---

- Start [jbrowse](https://github.com/GMOD/jbrowse-components): You may want to
  pull the latest code to be consistent with the GitHub workflow

```
cd /path/to/jbrowse-components
git pull
yarn --cwd products/jbrowse-web start
```

- Start Apollo server. Within the docker container (_i.e_ within vscode) and in
  distinct terminals run:

```
yarn --cwd packages/apollo-shared start
```

```
yarn --cwd packages/apollo-collaboration-server run cypress:start
```

```
yarn --cwd packages/jbrowse-plugin-apollo start
```

If above you change the name for the test database (`apolloTestDb`), change
accordingly in `commands.ts`

- Open cypress in the testing directory, _i.e._ where yo have the relevant
  `package.json`. Typically (again outside the dev container/vscode):

```
yarn --cwd packages/jbrowse-plugin-apollo run cypress open --config baseUrl=http://localhost:3000
```

- For end-to-end testing, click "E2E Testing" `->` Chrome `->`
  `Start E2E Testing`. Click on one of the available test scripts.

To run tests locally in headless mode:

```
yarn --cwd packages/jbrowse-plugin-apollo run cypress run \
  --browser chrome \
  --config '{"baseUrl": "http://localhost:3000",
             "screenshotOnRunFailure": true,
             "video": true,
             "videoCompression": false,
             "retries": {"runMode": 0}}' \
  --spec cypress/e2e/editFeature.cy.ts
```
