# Apollo3

Apollo is a graphical genome annotation tool built on JBrowse. Use it to view
and edit annotations in a single-user setup or collaborate with other annotators
through an Apollo server.

## Documentation

- [User guide](./packages/website/docs/01-user-guide/) — learn how to create and
  edit annotations.
- [Single-user setup](./packages/website/docs/02-single-user/index.md) — use
  Apollo with JBrowse Web or Desktop.
- [Local multi-user demo](./packages/website/docs/03-multi-user/01-local-demo/01-setting-up.md)
  — try the collaboration server with example data.
- [Multi-user installation](./packages/website/docs/03-multi-user/02-installation/01-background.md)
  — find setup and deployment instructions for a shared server.

See [the contribution guide](./CONTRIBUTING.md) to set up a development
environment.

## Packages

| Package                                                                | Description                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| [apollo-cli](./packages/apollo-cli/)                                   | Command-line administration tool                           |
| [apollo-collaboration-server](./packages/apollo-collaboration-server/) | Server-side code                                           |
| [apollo-common](./packages/apollo-common/)                             | Public base classes for developers creating Apollo plugins |
| [apollo-mst](./packages/apollo-mst/)                                   | mobx-state-tree models                                     |
| [apollo-schemas](./packages/apollo-schemas/)                           | MongoDB schemas                                            |
| [apollo-shared](./packages/apollo-shared/)                             | Internal code shared between server and client             |
| [jbrowse-plugin-apollo](./packages/jbrowse-plugin-apollo/)             | Client-side code (as a JBrowse 2 plugin)                   |
| [website](./packages/website/)                                         | Source for https://apollo.jbrowse.org                      |
