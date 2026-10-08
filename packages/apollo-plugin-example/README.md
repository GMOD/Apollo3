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

## End-to-end tests

The Cypress tests in `cypress/` load both halves into a running collaboration
server and JBrowse. They need, all on `localhost`:

| Port  | What                                      | How to start it                                                   |
| ----- | ----------------------------------------- | ----------------------------------------------------------------- |
| 27017 | MongoDB, as a replica set                 |                                                                   |
| 3838  | This package's built files                | `yarn build && yarn serve:dist` here                              |
| 3999  | The collaboration server, with the plugin | `yarn cypress:start:example` in `apollo-collaboration-server`     |
| 9000  | The Apollo JBrowse plugin's built files   | `yarn build && yarn start:server` in `jbrowse-plugin-apollo`      |
| 8999  | JBrowse                                   | `yarn browse` in `jbrowse-plugin-apollo` (after `jbrowse create`) |

Start the file server on 3838 before the collaboration server, which fetches
`dist/server.bundle.js` from it (`PLUGIN_URLS`) when it starts. The server uses
its own database, `apolloExampleTestDb`. The tests add the client half by
storing a `plugins` entry in the JBrowse configuration in MongoDB
(`setupJBrowseConfig` in `cypress/support/commands.ts`).

Then run `yarn cypress:run` (or `yarn cypress:open`) here.

To try the plugin by hand, start the collaboration server with
`PLUGIN_URLS=http://localhost:3838/dist/server.bundle.js yarn start`, and add
`http://localhost:3838/dist/plugin-example.umd.development.js` to the plugins in
JBrowse's configuration.
