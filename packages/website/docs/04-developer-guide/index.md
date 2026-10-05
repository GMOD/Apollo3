# Developer guide

Apollo can be customized with plugins. A plugin can have up to two halves, one
for each place Apollo runs:

- **A client half**, which is an ordinary
  [JBrowse plugin](https://jbrowse.org/jb2/docs/developer_guides/creating_plugins/)
  that uses Apollo's extension points. It's built as a browser (UMD) bundle and
  added to JBrowse's `config.json` like any other JBrowse plugin.
- **A server half**, which is an `ApolloServerPlugin` for the Apollo
  collaboration server. It's plain Node code with no dependency on JBrowse,
  published as an npm package or a Node-targeted bundle.

A plugin that only changes how Apollo looks or behaves in the browser needs only
a client half. A plugin that only changes what the server does (custom login,
assembly access, ...) needs only a server half. Many plugins need both: a custom
change type, for example, has to be applied in the browser and on the server.
Build both halves from one source package and keep shared code (change classes,
checks, change rules) in a module both import.

The
[example plugin](https://github.com/GMOD/Apollo3/tree/main/packages/apollo-plugin-example)
in the Apollo repository has both halves and uses most of the APIs described in
this guide.

## The plugin API package

Everything a plugin needs from Apollo is in `@apollo-annotation/common`, which
has three entry points:

| Entry point                        | Contents                                                                                                                    | Used by         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `@apollo-annotation/common`        | Code that runs anywhere: the `Change`, `FeatureChange` and `Check` base classes, `ChangeRule`, and plain feature data types | Both halves     |
| `@apollo-annotation/common/client` | Client plugin types: client change types and validations, glyphs, and the types of Apollo's JBrowse extension points        | The client half |
| `@apollo-annotation/common/server` | Server plugin types: `ApolloServerPlugin`, its hooks, server change types and validations, routes, login and access types   | The server half |

The root entry point has no runtime dependencies. The `/client` and `/server`
entry points only need the packages the half they're for already has (for
example `@jbrowse/core` for the client, `mongoose` for the server), which are
optional peer dependencies.

## Topics

- [Server plugins](server-plugins.md): writing and loading a server plugin, and
  every server hook
- [Client plugins](client-plugins.md): every Apollo extension point in the
  JBrowse plugin
- [Custom change types](changes.md): new kinds of edits, applied on both the
  client and the server
- [Validations](validations.md): rejecting changes, with change rules and client
  and server validations
- [Checks](checks.md): finding problems in annotations
- [Custom login](custom-login.md): adding ways to log in
- [Restricting assembly access](assembly-access.md): limiting which users can
  access which assemblies
- [Custom server routes](custom-routes.md): adding HTTP endpoints to the server
- [Migrating plugins](migration.md): changes to the plugin API since Apollo 1.x
