# apollo-cli tests

These tests run the CLI against a live collaboration server.

## Setup

In VS Code, open the project in its dev container (Ctrl+Shift+P, then
`Dev Containers: Reopen in Container`). Then start what the tests need:
Ctrl+Shift+P, then `Tasks: Run Task`, then `Start: CLI tests`. This starts a
collaboration server that uses the `apolloTestCliDb` database and allows root
login, plus a server for the test data on port 3131.

Without VS Code, start the same things yourself:

```sh
yarn workspace @apollo-annotation/collaboration-server test:cli:start
```

```sh
cd packages/apollo-collaboration-server
yarn serve --no-request-logging --listen 3131 --no-port-switching test/data/
```

## Run the CLI tests

Run all tests:

```sh
yarn workspace @apollo-annotation/cli tsx src/test/test.ts
```

Run only the tests whose names match a regular expression:

```sh
yarn workspace @apollo-annotation/cli tsx --test-name-pattern='Print help|Feature get' src/test/test.ts
```

## Run the Docker test

```sh
yarn workspace @apollo-annotation/cli tsx src/test/test_docker.ts
```
