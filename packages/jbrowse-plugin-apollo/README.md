# Testing with cypress

These are some notes to setup cypress and run tests. These notes are likely to
change and temporary.


* One time step: **Outside** the Apollo dev container [install
  cypress](https://docs.cypress.io/guides/getting-started/installing-cypress).
  E.g. on your OS terminal (not vscode) run: 

```
yarn add cypress --dev
```

* Edit `.development.env` to work with a test database and give the guest user admin permission:

```
sed -i 's|^MONGODB_URI=mongodb://localhost:27017/apolloDb|MONGODB_URI=mongodb://localhost:27017/apolloTestDb|' packages/apollo-collaboration-server/.development.env 
sed -i 's|^# GUEST_USER_ROLE=readOnly|GUEST_USER_ROLE=admin|' packages/apollo-collaboration-server/.development.env
```

* Start Apollo server as usual.

* Open cypress in the testing directory, *i.e.* where yo have the relevant
  `package.json`. Typically (again outside the dev container/vscode):

```
cd packages/jbrowse-plugin-apollo/
yarn run cypress open
```

* For end-to-end testing, click "E2E Testing" `->` Chrome `->` `Start E2E
  Testing`. Click on one of the available test scripts.
