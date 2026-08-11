# Restricting assembly access

By default every logged-in user can see and act on every assembly on the server,
subject to their role. A server-side plugin can narrow that down, restricting
users to named assemblies and to everything belonging to those assemblies:
reference sequences, features, checks, change history and exports.

A restricted user's JBrowse client only lists the assemblies they may access,
and requests naming any other assembly, reference sequence or feature respond as
if it did not exist.

## Extension point

The name of the extension point to target for this is `Apollo-AssemblyAccess`.
You will need to call `pluginManager.addToExtensionPoint` in the `apolloInstall`
method of your plugin. Here is an example of using the extension point:

```ts
import { type AssemblyAccess } from '@apollo-annotation/common'

pluginManager.addToExtensionPoint(
  'Apollo-AssemblyAccess',
  (): AssemblyAccess =>
    new Map([
      ['alice@example.com', ['GRCh38', 'GRCm39']],
      ['bob@example.com', '*'],
    ]),
)
```

Unlike most extension points, this one is not handed an existing value to
extend: it starts as `undefined`, and whatever your callback returns becomes the
access rules.

- Keys are user email addresses.
- Values are either a list of assembly names or `'*'` for every assembly.
  Assembly names are matched against an assembly's name, display name and
  aliases; an assembly id also works.
- A plain object works as well as a `Map`, and your callback may return a
  `Promise` if it needs to look grants up asynchronously.

## Reading grants from MongoDB

The callback's second argument carries a `connection` prop, the Mongoose
connection to the Apollo database, so your plugin can keep its grants in Mongo
rather than hard-coding them. This is the same connection the `Apollo-MongoDB`
extension point provides, and the same one passed to the
[`Apollo-RegisterRoutes`](custom-routes.md) extension point if your plugin also
exposes its own HTTP endpoints.

```ts
import {
  type AssemblyAccess,
  type AssemblyAccessProps,
} from '@apollo-annotation/common'

pluginManager.addToExtensionPoint(
  'Apollo-AssemblyAccess',
  async (
    _extendee,
    { connection }: AssemblyAccessProps,
  ): Promise<AssemblyAccess> => {
    const grants = await connection
      .collection('assemblyAccess')
      .find()
      .toArray()
    return new Map(grants.map(({ email, assemblies }) => [email, assemblies]))
  },
)
```

Since the extension point is evaluated on every request, a callback that queries
the database like this should cache its result rather than querying each time.

## Behavior

- **If no plugin registers this extension point**, or your callback returns
  `undefined`, nothing is restricted and all users have access to all
  assemblies. This is how Apollo behaves without such a plugin.
- **A user your structure does not mention has access to no assemblies at all.**
  List every user who should have access, or grant them `'*'`.
- **Users with the `admin` role are never restricted**, whether or not you list
  them. This is a safety net so a plugin cannot lock everyone out of
  administering the server.
- **A restricted user cannot create new assemblies**, since a brand new assembly
  cannot have been granted to them yet.

The extension point is evaluated on every request, so grants take effect without
a restart, and assemblies created later are picked up automatically. A plugin
that does expensive work to answer — a database or directory lookup, say —
should cache its own result.

:::warning

If your callback throws, Apollo logs the error and carries on as though no
plugin were registered, which grants **everyone access to everything**. Apollo
logs a warning whenever this extension point is registered but still evaluates
to `undefined`, so watch for it in your server logs.

:::

:::note

Apollo broadcasts annotation changes to connected clients over a websocket that
does not currently apply these restrictions, so a modified client could still
observe edits to other assemblies. Treat this as a way of scoping what users
work with rather than as a guarantee of confidentiality.

:::
