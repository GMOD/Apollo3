---
sidebar_position: 1
---

# Server plugins

A server plugin is a class extending `ApolloServerPlugin`, default-exported from
its module. Its `install` method registers callbacks for hooks, which the
collaboration server calls at the points described below.

```ts
import {
  type ApolloServerHookRegistrar,
  ApolloServerPlugin,
} from '@apollo-annotation/common/server'

export default class MyPlugin extends ApolloServerPlugin {
  name = 'MyPlugin'

  install(registrar: ApolloServerHookRegistrar) {
    registrar.registerHook(
      'Apollo-RegisterRoutes',
      (routes, { connection }) => [
        ...routes,
        // ...
      ],
    )
  }
}
```

`registerHook` is typed, so your editor completes hook names and checks each
callback against its hook.

## Loading server plugins

Plugins are configured in
[the server's `.env` file](../03-multi-user/02-installation/04-configuration-options.md):

- `PLUGIN_URLS` or `PLUGIN_URLS_FILE`: URLs (or a file listing one URL per line)
  to fetch plugin bundles from at startup, with no rebuild. The URL must be
  `http:` or `https:` (not `file:`). Fetched bundles are cached by content hash.
  If you also configure an integrity hash for a URL (`PLUGIN_INTEGRITY`), a
  cached copy is used without fetching it again on restart.
- `PLUGIN_PACKAGES`: a comma-separated list of npm package specifiers, imported
  from the server's own dependencies. A package can name a subpath, e.g.
  `@my-org/my-apollo-plugin/server`.

Both can be used together. A server plugin must be a Node ES module (or
CommonJS), not a browser/UMD bundle.

### Which one to use

**If you run the published Docker image, use `PLUGIN_URLS`.** The server can
only import packages listed in its own `package.json` when its dependencies were
installed, so `PLUGIN_PACKAGES` can't load a package that isn't already part of
the image. Using it means building your own image: adding your plugin to the
collaboration server's dependencies and reinstalling them.

So if you're writing a plugin for others to use, publish a server bundle (see
below) that can be loaded with `PLUGIN_URLS`. You can also publish it as an npm
package for anyone who builds their own server.

### Dependencies

A plugin can leave the packages the server itself depends on unbundled, and
should, so it uses the server's own copies. List them as `peerDependencies` of
your plugin, since the version is whatever the server has:

- Plugins loaded with `PLUGIN_PACKAGES` resolve imports like any other installed
  package, so they can also use their own third-party dependencies.
- Bundles loaded from `PLUGIN_URLS` are a single file, cached inside the server
  package (in `.plugin-cache`), so their imports resolve as if the server itself
  made them. A bundle can leave unbundled only packages in the collaboration
  server's production `dependencies`, such as `@apollo-annotation/common` and
  `mongoose`. Everything else must be bundled in, including:

  - your plugin's own modules (no relative imports like `../shared/x.js`);
  - other third-party packages;
  - packages the server only has indirectly (e.g. `bson`, which comes with
    `mongoose`), or as a `devDependency` (e.g. `mongodb`). These may import fine
    in a development checkout but fail in the Docker image.

  If you set `PLUGIN_CACHE_DIR` to a directory outside the server package,
  nothing resolves against the server's dependencies, so the bundle must be
  fully self-contained.

To build a bundle, point a bundler such as rolldown, Rollup or esbuild at your
server entry point, target Node, output an ES module, and mark only the
server-provided packages as external. The
[example plugin](https://github.com/GMOD/Apollo3/tree/main/packages/apollo-plugin-example)
does this in `rolldown.server.config.mjs`:

```js
import { defineConfig } from 'rolldown'

const serverProvided = ['@apollo-annotation/common', 'mongoose']

export default defineConfig({
  input: 'src/server/index.ts',
  platform: 'node',
  external: (id) =>
    serverProvided.some((name) => id === name || id.startsWith(`${name}/`)),
  output: { file: 'dist/server.bundle.js', format: 'esm', sourcemap: true },
})
```

## Hooks

Every hook callback is called with a value to extend (the `extendee`) and some
`props`, and returns the new value. When several plugins register the same hook,
each callback gets the previous one's result, so add to the value you're given
rather than replacing it.

| Hook                                           | Value                                        | Props            | When it runs     |
| ---------------------------------------------- | -------------------------------------------- | ---------------- | ---------------- |
| [`Apollo-MongoDB`](#apollo-mongodb)            | none                                         | `{ connection }` | Once, at startup |
| [`Apollo-RegisterChangeTypes`](changes.md)     | `Record<string, ServerChangeType>`           | none             | Once, at startup |
| [`Apollo-RegisterValidations`](validations.md) | `(ChangeRule \| ServerValidation)[]`         | none             | Once, at startup |
| [`Apollo-RegisterChecks`](checks.md)           | `Check[]`                                    | none             | Once, at startup |
| [`Apollo-RegisterRoutes`](custom-routes.md)    | `PluginRoute[]`                              | `{ connection }` | Once, at startup |
| [`Apollo-RegisterCustomAuth`](custom-login.md) | `Map<string, CustomAuthHandler>`             | none             | Once, at startup |
| [`Apollo-AssemblyAccess`](assembly-access.md)  | `AssemblyAccess \| undefined` (starts empty) | `{ connection }` | On every request |

### When a callback throws

- **Startup hooks**: the error is logged with your plugin's name and the server
  doesn't start. A plugin that can't register what it's meant to is treated as a
  configuration error rather than silently skipped.
- **`Apollo-AssemblyAccess`**: the error is logged and the request is denied
  access to every assembly. Hooks that guard access fail closed, never open.

### Apollo-MongoDB

Called once at startup with the Mongoose connection to the Apollo database, for
plugins that need to set something up first, such as creating their own
collections or indexes. Its return value isn't used.

```ts
registrar.registerHook('Apollo-MongoDB', async (_extendee, { connection }) => {
  await connection.collection('myPluginWidgets').createIndex({ name: 1 })
})
```

The other hooks that need the database get the same connection in their `props`
or context, so a plugin doesn't have to keep it from this hook.

## What server code gets

Server change handlers, validations and route handlers get a context with:

- `user`: the user making the request (`id`, `username`, `email` and `role`)
- `connection`: the Mongoose connection. Apollo's own models can be used with
  e.g. `connection.model('Feature')`.
- `logger`: a logger whose output goes to the server log
- `session` (change handlers and validations after a change is applied): the
  MongoDB session of the transaction the change is applied in. Pass it to every
  query (`.session(session)`) so the query sees the change and is rolled back
  with it.
