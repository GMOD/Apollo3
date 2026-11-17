---
sidebar_position: 8
---

# Custom server routes

A server plugin can add HTTP endpoints to the Apollo collaboration server, for
example to serve data from its own MongoDB collection to the client half of the
same plugin.

## Hook

Register routes with the `Apollo-RegisterRoutes` hook in your
[server plugin's](server-plugins.md) `install` method:

```ts
registrar.registerHook('Apollo-RegisterRoutes', (routes, { connection }) => [
  ...routes,
  {
    method: 'GET',
    path: '/my-plugin-name/widgets/:id',
    handler: async (_req, res, { params }) => {
      const widget = await connection
        .collection('myPluginWidgets')
        .findOne({ id: params.id })
      if (!widget) {
        res.status(404).end()
        return
      }
      res.json(widget)
    },
  },
])
```

A route has:

- `method`: an HTTP method such as `'GET'` or `'POST'`.
- `path`: matched against the request path after `/plugin-routes`, so the route
  above answers `GET /plugin-routes/my-plugin-name/widgets/123`. Paths can have
  parameters (`/:id`) and wildcards (`/*rest`), as in Express 5. Start your
  paths with something unique to your plugin, such as its name, so they don't
  clash with another plugin's routes.
- `role` (optional): the minimum role a user needs to use the route: `'admin'`,
  `'user'`, `'readOnly'` (the default) or `'none'`, which makes the route
  available to anyone, including users who aren't logged in.
- `handler`: called with the Express request and response and a context.

## The handler context

The handler's third argument has:

- `params`: the values of the parameters in `path`
- `user`: the user making the request (`id`, `username`, `email` and `role`), or
  undefined if they aren't logged in
- `allowedAssemblyIds`: the IDs of the assemblies the user may access, or
  undefined if they may access all of them (see
  [Restricting assembly access](assembly-access.md)). A route that returns data
  belonging to assemblies should only return data from these.
- `connection`: the Mongoose connection to the Apollo database
- `logger`: a logger whose output goes to the server log

## Behavior

- A request that doesn't match any route gets a 404, and one from a user without
  the route's role gets a 403.
- If your handler throws, Apollo logs the error and responds with a 500 (unless
  your handler already sent a response).
- Routes are collected once, at startup. If your callback throws, or a route has
  an invalid `path`, the server doesn't start, and the log names your plugin.
