---
sidebar_position: 6
---

# Custom login

By default, Apollo can log users in with Google and Microsoft accounts. A server
plugin can add other ways to log in.

For an example, see this plugin that lets users log in with ORCID:
https://github.com/GMOD/jbrowse-plugin-apollo-orcid-login

## Hook

Register login methods with the `Apollo-RegisterCustomAuth` hook in your
[server plugin's](server-plugins.md) `install` method:

```ts
registrar.registerHook('Apollo-RegisterCustomAuth', (customAuths) => {
  customAuths.set('myCustomAuth', {
    message: 'Sign in with my custom auth',
    needsPopup: false,
    handler: async (request, redirectUri) => {
      // The full request is available, e.g. to read its headers
      return { name, email }
    },
  })
  return customAuths
})
```

The key (`'myCustomAuth'` above) identifies the login method. Its value, a
`CustomAuthHandler` (from `@apollo-annotation/common/server`), has:

- `message`: the text shown for this method on Apollo's login screen.
- `needsPopup`: `true` if the user logs in in another window, as in an OAuth2
  flow. Use `false` if the login needs no input from the user, for example if it
  uses information in the request's headers.
- `handler`: called with the request (and, for popup logins, the URI to return
  to, `redirectUri`). It returns a promise for either:

  - `{ name, email }` to log the user in. The name and email are shown in
    Apollo's user management, so if your login method doesn't provide them, use
    other identifying information. A user logging in for the first time gets the
    server's default role for new users (`DEFAULT_NEW_USER_ROLE`), or the admin
    role if there is no admin yet.
  - `{ url }` to send the user to another page first, such as an OAuth2
    provider's login page, which then sends them back to this login method.

  Throwing rejects the login.

Libraries like [Passport](https://www.passportjs.org/) can help with OAuth2
flows; the ORCID example uses
[`passport-orcid`](https://www.passportjs.org/packages/passport-orcid/).
