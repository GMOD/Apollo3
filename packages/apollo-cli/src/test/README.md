<!-- vim-markdown-toc GFM -->

- [Setup](#setup)
- [Run CLI tests](#run-cli-tests)
- [Run docker test](#run-docker-test)

<!-- vim-markdown-toc -->

These are instructions to execute the CLI tests.

# Setup

In VSCode open the Apollo project as container as usual (Ctrl+Shift+P then
`Dev container: Open folder in container`). Start Apollo for CLI testing:
Ctrl+Shift+P then `Run task` (enter) `Start-cli-test`.

Alternatively, the Apollo server must be configured to accept root user access
with the password the tests expect. For this, add the following to
`packages/apollo-collaboration-server/.development.local.env` (a gitignored file
that overrides `.development.env`):

```
ALLOW_ROOT_USER=true
ROOT_USER_PASSWORD=pass
```

then restart the collaboration server to make changes effective.

# Run CLI tests

Change to:

```
cd Apollo3/packages/apollo-cli
```

- To run all tests:

```
* yarn tsx src/test/test.ts
```

- To run only tests matching aregular expression:

```
 yarn tsx --test-name-pattern='Print help|Feature get' src/test/test.ts
```

# Run docker test

```
yarn tsx ./src/test/test_docker.ts
```
