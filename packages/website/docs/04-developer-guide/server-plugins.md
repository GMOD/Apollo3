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

- `PLUGIN_PACKAGES`: a comma-separated list of npm package specifiers, imported
  from the server's own dependencies. This is the recommended way if you build
  your own server image. A package can name a subpath, e.g.
  `@my-org/my-apollo-plugin/server`.
- `PLUGIN_URLS` or `PLUGIN_URLS_FILE`: URLs (or a file listing one URL per line)
  to fetch plugin bundles from at startup, with no rebuild. Fetched bundles are
  cached by content hash. If you also configure an integrity hash for a URL
  (`PLUGIN_INTEGRITY`), a cached copy is used without fetching it again on
  restart.

Both can be used together. A server plugin must be a Node ES module (or
CommonJS), not a browser/UMD bundle.

### Dependencies

A plugin can import `@apollo-annotation/common` and other packages the server
itself depends on (such as `mongoose`) without bundling them, and should, so it
uses the server's own copies:

- Plugins loaded with `PLUGIN_PACKAGES` resolve imports like any package
  installed alongside the server.
- Bundles loaded from `PLUGIN_URLS` are cached inside the server package (in
  `.plugin-cache`) so that their imports resolve against the server's
  dependencies. If you set `PLUGIN_CACHE_DIR` to a directory outside the server
  package, bundles loaded from URLs must be fully self-contained.

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
