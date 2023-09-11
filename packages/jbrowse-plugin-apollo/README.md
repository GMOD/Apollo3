# Testing with cypress

These are some notes to setup cypress and run tests. These notes are likely to
change and temporary.


* One time step: **Outside** the Apollo dev container [install
  cypress](https://docs.cypress.io/guides/getting-started/installing-cypress).
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

* Start Apollo server. Within the docker container (*i.e* within vscode) and in distinct terminals run:

```
yarn --cwd packages/apollo-shared start
```

```
yarn --cwd packages/apollo-collaboration-server run cypress:start
```

```
yarn --cwd packages/jbrowse-plugin-apollo start
```


If above you change the name fo the test database (`apolloTestDb`), change accordingly in `commands.ts`

* Open cypress in the testing directory, *i.e.* where yo have the relevant
  `package.json`. Typically (again outside the dev container/vscode):

```
yarn --cwd packages/jbrowse-plugin-apollo run cypress open
```

* For end-to-end testing, click "E2E Testing" `->` Chrome `->` `Start E2E
  Testing`. Click on one of the available test scripts.
