<!-- vim-markdown-toc GFM -->

- [Setup](#setup)
- [Run CLI tests](#run-cli-tests)

<!-- vim-markdown-toc -->

These are instructions to execute the CLI tests.

# Setup

The Apollo server must be configured to accept root user access. For this edit
`packages/apollo-collaboration-server/.development.env` as:

```
sed -i'' 's/# ALLOW_ROOT_USER=false/ALLOW_ROOT_USER=true/;
          s/# ROOT_USER_NAME=root/ROOT_USER_NAME=admin/;
          s/# ROOT_USER_PASSWORD=password/ROOT_USER_PASSWORD=pass/' packages/apollo-collaboration-server/.development.env
```

then restart the collaboration server to make changes effective.

# Run CLI tests

Change to Apollo3/packages/apollo-cli and make this script executable:

```
chmod a+x ./test/test.py
```

- To run all tests:

```
./test/test.py
```

- To run only one test, e.g. `testAddAssemblyFromGff`:

```
./test/test.py TestCLI.testAddAssemblyFromGff
```

If you edit the `test.py`, you may want to re-format it with
[black](https://black.readthedocs.io/en/stable/index.html):

```
black test/test.py
```
