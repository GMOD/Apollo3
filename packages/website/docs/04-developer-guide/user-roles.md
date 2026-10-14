---
sidebar_position: 8
---

# Setting user roles

By default, a user's role (`admin`, `user`, `readOnly` or `none`) is managed in
Apollo itself. The first user to log in becomes an admin, other new users get
`DEFAULT_NEW_USER_ROLE`, and admins change roles from Apollo's user management
screen. A server-side plugin can instead decide roles when users log in, for
example from groups or roles managed in your organization's identity provider.

## Hook

Register the `Apollo-UserRole` hook in your [server plugin's](server-plugins.md)
`install` method:

```ts
import {
  type UserRole,
  type UserRoleProps,
} from '@apollo-annotation/common/server'

registrar.registerHook(
  'Apollo-UserRole',
  (role: UserRole, { loginType, claims }: UserRoleProps): UserRole => {
    if (loginType !== 'keycloak') {
      return role
    }
    const groups = Array.isArray(claims?.groups) ? claims.groups : []
    if (groups.includes('apollo-admins')) {
      return 'admin'
    }
    if (groups.includes('apollo-curators')) {
      return 'user'
    }
    return 'readOnly'
  },
)
```

The callback gets the role the user would have without it: their current role,
or for a first-time login, the role Apollo would give a new user. Whatever the
callback returns becomes the user's role and is saved in the database, so it
also shows up on Apollo's user management screen. Return the role you were given
(or `undefined`) to leave it unchanged.

The `props` are:

| Prop         | Description                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`      | The email address of the user logging in                                                                                                                            |
| `name`       | Their display name                                                                                                                                                  |
| `loginType`  | The login type they used, e.g. `google`, the name of a provider in `OIDC_PROVIDERS`, or a [custom login](custom-login.md) type                                      |
| `claims`     | For OpenID Connect logins, the claims from the identity provider's ID token, merged with its userinfo response if the token has no email. Not set for custom logins |
| `isNewUser`  | Whether this is the user's first login                                                                                                                              |
| `connection` | The Mongoose connection to the Apollo database                                                                                                                      |

Many identity providers only put group or role claims in the ID token if you
configure them to, for example with a "groups" or "client roles" mapper.

## Behavior

- **The hook runs when users log in through an identity provider or a custom
  login**, not for the root or guest users, and not on every request. Apollo
  includes a user's role in the token it issues at login, so a role changed in
  your identity provider takes effect the next time the user logs in.
- **Roles set by an admin in Apollo are overwritten** at the user's next login,
  if your callback returns a different role. Let your identity provider be the
  single place roles are managed.
- **If your callback throws, or returns something that isn't a role, the login
  is refused** and the error is logged with your plugin's name. Like
  [`Apollo-AssemblyAccess`](assembly-access.md), this hook fails closed.
- To restrict which assemblies users can reach as well, see
  [Restricting assembly access](assembly-access.md).
