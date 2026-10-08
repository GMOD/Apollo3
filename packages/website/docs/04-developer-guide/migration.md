---
sidebar_position: 9
---

# Migrating plugins

This page lists the changes to the plugin API since Apollo 1.x that may require
changes to existing plugins.

## Packages and imports

- The server plugin API moved to the `@apollo-annotation/common/server` entry
  point: `ApolloServerPlugin`, the hook types, `AssemblyAccess`,
  `CustomAuthHandler` and `PluginRoute`. Client plugin types are in the new
  `@apollo-annotation/common/client` entry point.
- `@apollo-annotation/common` no longer depends on `@apollo-annotation/schemas`,
  `@jbrowse/core` or `bson-objectid`. Server and client types it uses are
  optional peer dependencies.
- `Check.checkFeature` uses the plain `AnnotationFeatureSnapshot` and
  `CheckResultSnapshot` types from `@apollo-annotation/common` instead of the
  ones from `@apollo-annotation/mst`. Snapshots of client features are still
  accepted.

## Changes

- Registering a change type now registers how to apply it, too. On the server,
  `Apollo-RegisterChangeTypes` takes `{ changeType, handler, requiredRole }`
  objects instead of change classes. On the client, use the new
  `Apollo-RegisterChangeTypes` extension point with `{ changeType, handler }`.
  Before, change types from plugins could be registered but were never applied.
  See [Custom change types](changes.md).
- `FeatureChange` no longer has `getFeatureFromId`, `addChild`,
  `findAndDeleteChildFeature` or `generateNewIds`, which worked on database
  documents. Server change handlers should find and modify features themselves.
- `MergeTranscriptsChange` no longer has `mergeTranscriptsOnServer` or
  `mergeFeatureIntoTranscriptOnServer`.
- `Change.logger` is typed with a small `Logger` interface instead of NestJS's
  `LoggerService`, and is now public.

## Validations

The `Validation` class, with its `frontendPreValidate`, `frontendPostValidate`,
`backendPreValidate`, `backendPostValidate` and `possibleValues` methods, is
replaced by three kinds of validation (see [Validations](validations.md)).
Validations now return an error message, or nothing, instead of a
`ValidationResult`.

| Before                                                   | Now                                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A check that only looks at the change                    | `ChangeRule.validate`, run on both client and server                                                                                   |
| `frontendPreValidate`                                    | `ClientValidation.preValidate`                                                                                                         |
| `frontendPostValidate`                                   | `ClientValidation.postValidate`                                                                                                        |
| `backendPreValidate(change)`                             | `ServerValidation.preValidate`                                                                                                         |
| `backendPostValidate(change, { session, featureModel })` | `ServerValidation.postValidate`, with `{ session, connection, user, logger }`; use `connection.model('Feature')` for the feature model |
| `backendPreValidate(context)` (request authorization)    | Not available to plugins; use a route's or change type's role                                                                          |
| `possibleValues`                                         | Removed                                                                                                                                |

- The `Apollo-RegisterValidations` server hook takes `ChangeRule`s and
  `ServerValidation`s. Client validations are registered with the new
  `Apollo-RegisterValidations` client extension point.
- `@apollo-annotation/shared` no longer exports `Validation`, `ValidationSet`,
  `validationRegistry`, `Context`, `isContext`, `CoreValidation` or
  `ParentChildValidation`.

## Client extension points

- Change types, checks and validations from client plugins are registered with
  the `Apollo-RegisterChangeTypes`, `Apollo-RegisterChecks` and
  `Apollo-RegisterValidations` extension points, rather than by importing
  Apollo's registries (which, since each plugin bundles its own copy, were never
  Apollo's).
- `Apollo-extendAnnotationFeature` is removed. The extended model was never used
  for the features in the client's data store, so additions to it didn't take
  effect.
- `Apollo-ReservedAttributeKeys` callbacks get a copy of the default keys, so
  changing the object they're given no longer has lasting effects. Return a new
  object.
- Components added to the transcript details widget also get a `submitChange`
  prop.
- Apollo's extension points are now part of JBrowse's typed extension point
  registry. Code that passed values of the wrong type may no longer compile.

New extension points: `Apollo-GetGlyph`, `Apollo-FeatureContextMenuItems` and
`Apollo-FeatureDetailsCustomComponent-*` (see
[Client plugins](client-plugins.md)).

## Server routes

- A route handler now gets a third argument with the path parameters (`params`;
  `req.params` isn't populated), the user, the assemblies they may access, the
  database connection and a logger.
- Routes can set the `role` they need. Without one, they still need the
  read-only role.
- Paths can have parameters and wildcards, and an invalid path stops the server
  from starting.

## Permissions

`AddAssemblyFromExternalChange`, `AddAssemblyAliasesChange` and
`ImportJBrowseConfigChange` now need the admin role, like Apollo's other changes
that manage assemblies and the server's JBrowse configuration. The "Save track
to Apollo" and "Remove track from Apollo" track menu items, which submit
`ImportJBrowseConfigChange`s, are only shown to admins.

## Server configuration

- `PLUGIN_URLS_FILE` can now be used on its own (it was rejected unless
  `PLUGIN_URLS` was also set, which isn't allowed either).
- `PLUGIN_INTEGRITY` entries are checked at startup, and URLs in them can have
  query strings.
- Bundles loaded from `PLUGIN_URLS` are cached in `.plugin-cache` in the server
  package instead of the system's temporary directory, so their imports of
  packages like `@apollo-annotation/common` resolve.
