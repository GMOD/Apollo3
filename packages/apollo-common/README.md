# @apollo-annotation/common

Base classes and registries for writing [Apollo](https://apollo.jbrowse.org)
plugins. Most people don't need this package directly. To use Apollo, see
[apollo.jbrowse.org](https://apollo.jbrowse.org).

This package is Apollo's public API for plugin authors. It includes:

- `ApolloPlugin`: a JBrowse plugin with an `apolloInstall` method, which runs on
  both the collaboration server and the client. Use it to add to Apollo
  extension points such as `Apollo-RegisterCustomAuth`.
- `Check` and `checkRegistry`: write and register your own checks on gene
  models.
- `Change`, `FeatureChange`, `AssemblySpecificChange` and `changeRegistry`: the
  base classes for edits that Apollo records in its changelog.

See the [developer guide](https://apollo.jbrowse.org/docs/developer-guide) for
how to write and load Apollo plugins.

This package is part of the [Apollo monorepo](https://github.com/GMOD/Apollo3).
