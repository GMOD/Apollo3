<!-- vim-markdown-toc GFM -->

- [Setup](#setup)
- [Run CLI tests](#run-cli-tests)

<!-- vim-markdown-toc -->

These are instructions to execute the CLI tests.

# Setup

In VSCode open the Apollo project as container as usual (Ctrl+Shift+P then
`Dev container: Open folder in container`). Start Apollo for CLI testing:
Ctrl+Shift+P then `Run task` (enter) `Start-cli-test`.

Alternatively, the Apollo server must be configured to accept root user access.
For this edit `packages/apollo-collaboration-server/.development.env` as:

```
sed -i'' 's/# ALLOW_ROOT_USER=false/ALLOW_ROOT_USER=true/;
          s/# ROOT_USER_PASSWORD=password/ROOT_USER_PASSWORD=pass/' packages/apollo-collaboration-server/.development.env
```

then restart the collaboration server to make changes effective.

# Run CLI tests

Change to:

```
cd Apollo3/packages/apollo-cli
```

- To run all tests:

```
* yarn tsx test/test.ts
```

- To run only tests matching aregular expression:

```
 yarn tsx --test-name-pattern='Print help|Feature get' test/test.ts
```

# Run docker test

```
yarn tsx ./test/test_docker.ts
```
