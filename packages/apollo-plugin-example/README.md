# Apollo example plugin

An example of extending Apollo with a plugin. It has two halves, built from one
package:

- **Client** (`src/index.ts`): a JBrowse plugin, built as a UMD bundle
  (`dist/plugin-example.umd.production.min.js`) and added to JBrowse's
  `config.json` like any other JBrowse plugin.
- **Server** (`src/server/index.ts`): an `ApolloServerPlugin` for the
  collaboration server, built as a single ES module (`dist/server.bundle.js`,
  see `rolldown.server.config.mjs`) and loaded by serving it over HTTP and
  setting `PLUGIN_URLS` to its URL. This is how plugins are added to the
  published Docker image. `@apollo-annotation/common` is left out of the bundle,
  since the server provides it.

Code used by both halves is in `src/shared`.

## What it shows

| Feature                                                            | Where                                                                                                |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| A custom change type, with a client and a server handler           | `shared/ExampleNotesChange.ts`, `index.ts`, `server/index.ts`                                        |
| A change rule, run on both the client and the server               | `shared/ExampleNoteLengthRule.ts`                                                                    |
| A check, run on both the client and the server                     | `shared/ExampleShortFeatureCheck.ts`                                                                 |
| Drawing a feature type with one of Apollo's built-in glyphs        | `Apollo-GetGlyph` in `index.ts`                                                                      |
| Feature context menu items that submit a change, one from a dialog | `Apollo-FeatureContextMenuItems` in `index.ts`, `components/AddNoteDialog.tsx`                       |
| Offering an attribute key when adding an attribute                 | `Apollo-ReservedAttributeKeys` in `index.ts`                                                         |
| A custom editor and viewer for one attribute                       | `Apollo-AttributeEditorComponent` and `Apollo-AttributeViewerComponent` in `index.ts`, `components/` |
| A server route that respects assembly access restrictions          | `notesRoute` in `server/index.ts`                                                                    |

See the [developer guide](../website/docs/04-developer-guide/index.md) for
details of each plugin API.

## Building and testing

```sh
yarn build   # type-checks, then builds the client and server bundles
yarn test    # unit tests for both halves
```

The Apollo JBrowse plugin and collaboration server tests also load this plugin
into the real plugin machinery (`examplePlugin.test.ts` and
`examplePlugin.spec.ts`).
