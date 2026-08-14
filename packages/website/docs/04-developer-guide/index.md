# Developer guide

Apollo provides for various forms of customization through the use of Apollo
plugins. The Apollo collaboration server and the Apollo JBrowse plugin have
**separate plugin systems**, each using the artifact format natural to its own
runtime:

- **Client-side plugins** are ordinary JBrowse plugins — a browser/UMD bundle,
  loaded exactly the same way as any other JBrowse plugin. Nothing about these
  is Apollo-specific.
- **Server-side plugins** are plain Node code — either an npm package or a
  Node-targeted (not browser/UMD) ESM/CJS bundle — with no dependency on
  `@jbrowse/core` at all.

These used to be the same physical bundle, sharing one build for both runtimes.
That caused real problems: a UMD bundle built for the browser doesn't reliably
load in Node, and Node-only code (native modules, `fs`, DB drivers) in a file
that also has to run in a browser bundle is easy to get wrong in ways that
silently break the client. Splitting the two removes both problems, at the cost
of maintaining two build outputs for a plugin that needs both halves (see
[Plugins needing both a client and server half](#plugins-needing-both-a-client-and-server-half)
below).

## Server-side plugins

A server-side plugin is a class implementing `ApolloServerPlugin` from
`@apollo-annotation/common`:

```ts
import type { ApolloServerHookRegistrar } from '@apollo-annotation/common'
import { ApolloServerPlugin } from '@apollo-annotation/common'

export default class MyPlugin extends ApolloServerPlugin {
  name = 'MyPlugin'

  install(registrar: ApolloServerHookRegistrar) {
    registrar.registerHook(
      'Apollo-RegisterRoutes',
      (routes, { connection }) => {
        // ...
        return routes
      },
    )
  }
}
```

Build it as a Node-targeted bundle (e.g. with esbuild/tsup using
`platform: 'node'`) or, more simply, just publish it as a regular npm package.
Then load it one of two ways, configured in
[your `.env` file](../03-multi-user/02-installation/04-configuration-options.md):

- `PLUGIN_PACKAGES`: a comma-separated list of npm package specifiers, imported
  from the server's own `node_modules`. This is the recommended path for
  self-hosted operators who already control their own server image/build.
- `PLUGIN_URLS`/`PLUGIN_URLS_FILE`: a comma-separated list of URLs (or a file
  listing one URL per line) to fetch a plugin bundle from at startup, with no
  rebuild required. Useful for hosted/managed deployments. Fetched bundles are
  cached by content hash; if you also configure an integrity hash for the URL
  (`PLUGIN_INTEGRITY`), a cache hit skips the network fetch entirely on restart.
  Without a configured hash, the URL is always fetched, since the content isn't
  known until after the fetch — but an unchanged file is not rewritten to disk.

Both can be used together; every plugin found across both is loaded.

Examples of server-side plugin capabilities:

- [Custom login](custom-login.md): Add other forms of login to the default
  Google and Microsoft logins.
- [Restricting assembly access](assembly-access.md): Limit which users can
  access which assemblies.
- [Custom server routes](custom-routes.md): Expose your own HTTP endpoints,
  backed by your own MongoDB collections, for a client-side plugin to call.

## Client-side plugins

Client-side plugins are used in exactly the same way as any other JBrowse
plugin. You will add a URL of your plugin file to your `config.json`. For
information on how to do so, see the
[JBrowse docs](https://jbrowse.org/jb2/docs/config_guides/plugins/), and
additionally the [JBrowse guide](../03-multi-user/03-guides/jbrowse.md) in these
docs if you're working with a multi-user collaboration server.

## Plugins needing both a client and server half

Custom login is the clearest example: it needs a server-side token handler _and_
a client-side login button/redirect. Rather than one bundle for both, build
**two artifacts from one source package** — a client entry point built with your
usual JBrowse/UMD config, and a server entry point built with a Node-targeted
config — and publish/version them together. Operators configure each half
separately (a `config.json` entry for the client bundle, a
`PLUGIN_URLS`/`PLUGIN_PACKAGES` entry for the server bundle).
