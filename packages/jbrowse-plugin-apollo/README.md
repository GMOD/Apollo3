# Testing with cypress

These are some notes to setup cypress and run tests. These notes are likely to change and temporary.

* Edit `packages/apollo-collaboration-server/.development.env` to set `GUEST_USER_ROLE=admin`. You may also need to delete the user "Guest" from mongodb (`apolloDb -> users`). Memo: If you login to Apollo as Guest you will need to reload the page a couple of times to see the admin options available.

* One time step: **Outside** the Apollo dev container [install cypress](https://docs.cypress.io/guides/getting-started/installing-cypress). E.g. on your OS terminal (not vscode) run: 

```
yarn add cypress --dev
```

* If not already running, start the Apollo server as usual.

* Open cypress in the testing directory, *i.e.* where yo have the relevant `package.json`. Typically (again outside the dev container/vscode):

```
cd packages/jbrowse-plugin-apollo/
yarn run cypress open
```

* For end-to-end testing, click "E2E Testing" `->` Chrome `->` `Start E2E Testing`. Click on one of the available test scripts.