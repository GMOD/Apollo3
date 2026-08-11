# Custom server routes

A server-side plugin can manage its own data — for example, its own MongoDB
collection — and expose it to the outside world by registering HTTP routes on
the Apollo collaboration server. This is what a client-side plugin (a menu item
that opens a dialog, say) would call to talk to the server-side half of the same
plugin.

## Extension point

The name of the extension point to target for this is `Apollo-RegisterRoutes`.
You will need to call `pluginManager.addToExtensionPoint` in the `apolloInstall`
method of your plugin. Here is an example of using the extension point:

```ts
import {
  type PluginRoute,
  type PluginRouteProps,
} from '@apollo-annotation/common'

pluginManager.addToExtensionPoint(
  'Apollo-RegisterRoutes',
  (routes: PluginRoute[], { connection }: PluginRouteProps): PluginRoute[] => {
    routes.push({
      method: 'GET',
      path: '/my-plugin-name/widgets',
      handler: async (_req, res) => {
        const widgets = await connection
          .collection('myPluginWidgets')
          .find()
          .toArray()
        res.json(widgets)
      },
    })
    return routes
  },
)
```

Unlike most extension points, this one is not handed an existing value to
extend: it starts as an empty array, and whatever your callback returns becomes
the full list of plugin routes served by the collaboration server. If more than
one plugin registers this extension point, push onto the array you're given
rather than returning a new one, so every plugin's routes survive.

- `method` is an HTTP method such as `'GET'` or `'POST'`.
- `path` is matched against the request path with the `/plugin-routes` prefix
  removed, so the route above answers requests to
  `GET /plugin-routes/my-plugin-name/widgets`. Prefix your own routes with
  something unique to your plugin — its `name` is a reasonable choice — so you
  don't collide with routes another plugin registers.
- `handler` receives the same Express `Request`/`Response` objects a built-in
  controller would, so read `req.body`/`req.query`/`req.params` and write the
  response with `res.json(...)`/`res.status(...)` as usual.

The callback's second argument carries the same `connection` prop the
`Apollo-MongoDB` extension point provides, so a plugin's routes can read and
write their own collection directly.

## Behavior

- Requests to `/plugin-routes/*` pass through the same authentication and
  authorization guards as every other endpoint on the server, so `req.user` is
  populated for a logged-in request by the time your handler runs. Every plugin
  route requires at least a logged-in, read-only user; if a particular route
  needs a stricter role, check the user's role yourself inside the handler.
- A request that doesn't match any registered `method`/`path` pair gets a 404.
- If your handler throws, Apollo logs the error and responds with a 500 (unless
  your handler already sent a response).
- Routes are collected once, at server startup, from every loaded plugin — there
  is no way to add or remove a route without restarting the server.
