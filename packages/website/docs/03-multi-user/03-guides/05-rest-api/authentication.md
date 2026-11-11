---
title: Authentication
description: How to get a token for the Apollo collaboration server's REST API
---

# Authentication

Most requests need a token, which is a JSON Web Token (JWT) sent in an
`Authorization` header:

```sh
curl -H "Authorization: Bearer $TOKEN" "$APOLLO_URL/assemblies"
```

Tokens are valid for one day. In these examples, `$APOLLO_URL` is your server's
URL, e.g. `https://example.org/apollo`.

## Roles

Each user has a role, and each endpoint needs a minimum role. A role includes
everything the roles below it can do:

| Role       | Can                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`    | Manage assemblies, users, and uploaded files, plus everything `user` can do                                                              |
| `user`     | Edit annotations, plus everything `readOnly` can do                                                                                      |
| `readOnly` | View assemblies, annotations, and the change log                                                                                         |
| `none`     | Only use endpoints that don't need a role, such as logging in. New users start with this role unless the server is configured otherwise. |

A request without a token, or with an invalid or expired token, has the role
`none`. If a request's role is too low for the endpoint, the server responds
with `403 Forbidden`.

For [`POST /changes`](reference/changes-controller-create.api.mdx), the role
needed also depends on the type of change. For example, deleting an assembly
needs `admin`. The endpoint's page lists the role for each change type.

## Getting a token

Which logins are available depends on how the server is
[configured](/docs/multi-user/installation/login-management). To see which ones
a server allows, use
[`GET /auth/types`](reference/authentication-controller-get-login-types.api.mdx):

```sh
curl "$APOLLO_URL/auth/types"
```

```json
[
  { "name": "google", "message": "Sign in with Google", "needsPopup": true },
  { "name": "guest", "message": "Continue as Guest", "needsPopup": false }
]
```

The `name` of a login type is what the other login endpoints take as `type`.
Login types with `needsPopup` need the user to log in in a browser. For a
script, use a [device login](#device-login) for these.

### Root user

If the server allows a root user (`ALLOW_ROOT_USER`), log in with its password
using
[`POST /auth/root`](reference/authentication-controller-root-login.api.mdx). The
root user is an admin, so this is useful for scripts that manage the server.

```sh
curl -X POST "$APOLLO_URL/auth/root" \
  -H "Content-Type: application/json" \
  -d '{"password": "your-root-password"}'
```

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

### Guest user

If the server allows guests (`ALLOW_GUEST_USER`), get a guest token with
[`GET /auth/guest`](reference/authentication-controller-guest-login.api.mdx).
The guest's role is set with `GUEST_USER_ROLE`.

```sh
curl "$APOLLO_URL/auth/guest"
```

### Device login

A device login lets a program that can't open a browser itself, such as a script
on a remote server, get a token for a user. The user logs in with a browser on
any computer. This is how `apollo login` in the
[CLI](/docs/multi-user/guides/cli) works. It's based on the
[OAuth 2.0 device authorization grant](https://www.rfc-editor.org/rfc/rfc8628).

1. Start the login with
   [`POST /auth/device`](reference/authentication-controller-start-device-login.api.mdx),
   passing the login type to use:

   ```sh
   curl -X POST "$APOLLO_URL/auth/device" \
     -H "Content-Type: application/json" \
     -d '{"type": "google"}'
   ```

   ```json
   {
     "device_code": "Dfg7...",
     "user_code": "BCDF-GHJK",
     "verification_uri": "https://example.org/apollo/auth/device",
     "verification_uri_complete": "https://example.org/apollo/auth/device?user_code=BCDF-GHJK",
     "expires_in": 600,
     "interval": 5
   }
   ```

2. Show the user `verification_uri_complete` and `user_code`. They open the
   link, check that the code matches, and log in. Keep `device_code` secret.

3. Every `interval` seconds, ask for the token with
   [`POST /auth/device/token`](reference/authentication-controller-get-device-login-token.api.mdx):

   ```sh
   curl -X POST "$APOLLO_URL/auth/device/token" \
     -H "Content-Type: application/json" \
     -d '{"device_code": "Dfg7..."}'
   ```

   Until the user has logged in, the response has status 400 and an `error`:

   - `authorization_pending`: the user hasn't finished logging in yet, so keep
     polling.
   - `slow_down`: you're polling too often. Add 5 seconds to the interval.
   - `expired_token`: the login expired (after `expires_in` seconds), so start a
     new one.

   Once the user has logged in, the response has the token:

   ```json
   { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
   ```

### Browser login

A web app can log a user in by sending them to
[`GET /auth/login`](reference/authentication-controller-handle-login.api.mdx)
with the login type and a `redirect_uri` to come back to:

```text
https://example.org/apollo/auth/login?type=google&redirect_uri=https://my-app.example.org/logged-in
```

After the user logs in, the browser is sent to `redirect_uri` with the token in
an `access_token` query parameter, or with an `error` parameter if the login
failed. `redirect_uri` must be on the Apollo server's own origin, on this
computer (e.g. `http://localhost:3000`), or on an origin listed in the server's
`ALLOWED_REDIRECT_ORIGINS`.

## Refreshing a token

If a user's role changes, such as when an admin gives them access, their token
still has the old role. Get a token with their current role from
[`POST /auth/refresh`](reference/authentication-controller-refresh-token.api.mdx),
sending the current token. The new token expires when the old one would have, so
you can't use this to stay logged in longer. To keep working after a token
expires, log in again.

```sh
curl -X POST "$APOLLO_URL/auth/refresh" -H "Authorization: Bearer $TOKEN"
```
