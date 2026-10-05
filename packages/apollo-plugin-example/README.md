# Apollo example plugin

An example of extending Apollo with a plugin. It has two halves, built from one
package:

- **Client** (`src/index.ts`): a JBrowse plugin, built as a UMD bundle
  (`dist/plugin-example.umd.production.min.js`) and added to JBrowse's
  `config.json` like any other JBrowse plugin.
- **Server** (`src/server/index.ts`): an `ApolloServerPlugin` for the
  collaboration server, loaded with
  `PLUGIN_PACKAGES=@apollo-annotation/plugin-example/server`.

Code used by both halves is in `src/shared`.

## What it shows

| Feature                                                     | Where                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| A custom change type, with a client and a server handler    | `shared/ExampleNotesChange.ts`, `index.ts`, `server/index.ts` |
| A change rule, run on both the client and the server        | `shared/ExampleNoteLengthRule.ts`                             |
| A check, run on both the client and the server              | `shared/ExampleShortFeatureCheck.ts`                          |
| Drawing a feature type with one of Apollo's built-in glyphs | `Apollo-GetGlyph` in `index.ts`                               |
| A feature context menu item that submits a change           | `Apollo-FeatureContextMenuItems` in `index.ts`                |
| A server route that respects assembly access restrictions   | `notesRoute` in `server/index.ts`                             |

See the [developer guide](../website/docs/04-developer-guide/index.md) for
details of each plugin API.

## Building and testing

```sh
yarn build   # type-checks, builds the server half to dist/ and the client bundle
yarn test    # unit tests for both halves
```

The Apollo JBrowse plugin and collaboration server tests also load this plugin
into the real plugin machinery (`examplePlugin.test.ts` and
`examplePlugin.spec.ts`).
