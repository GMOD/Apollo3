# Custom login

By default, Apollo provides the ability to set up user logins with Google and
Microsoft credentials. You can also extend Apollo to be able to use other ways
to log in as well.

As an example, see this plugin that adds the ability to log in to Apollo with
ORCID credentials: https://github.com/GMOD/jbrowse-plugin-apollo-orcid-login

## Extension point

The name of the extension point to target for this is
`Apollo-RegisterCustomAuth`. You will need to call
`pluginManager.addToExtensionPoint` in the `apolloInstall` method of your
plugin. Here is an example of using the extension point:

```ts
pluginManager.addToExtensionPoint(
  'Apollo-RegisterCustomAuth',
  (
    customAuths: Map<
      string,
      {
        message: string
        needsPopup: boolean
        handler: (request: Request) => Promise<{ name: string; email: string }>
      }
    >,
  ) => {
    customAuths.set('myCustomAuth', {
      message: 'Sign in with my custom auth',
      needsPopup: false,
      handler: async (request: Request) => {
        // The full "request" object is available to inspect headers, etc.
        return { name, email }
      },
    })
    return customAuths
  },
)
```

Here is an explanation of the entries in the custom auth object:

- `message`: This is the text that will dislay on the login choosing screen in
  Apollo.
- `needsPopup`: If your login type requires the user to enter their credentials
  in another window, such as an OAuth2 sign in workflow, this should be `true`.
  In some cases where you handle the sign in workflow yourself without the user
  needing to enter anything (such as using information present in the requests's
  headers to sign in), this can be `false`.
- `handler`: A function that takes the `request` object as a parameter and
  returns a promise for a `{ name, email }` object. Name and email are shown in
  the in-app user management display for convenience, but if your sign in
  workflow doesn't provide a name or email, you can use any identifying
  information there. The `request` object can be used to initiate advanced sign
  in types such as OAuth2 flows, and these can be helped by libraries such as
  those provided by [passport](https://www.passportjs.org/). The example linked
  above uses the
  [`passport-orcid`](https://www.passportjs.org/packages/passport-orcid/)
  package to enable login with ORCID's OAuth2 system.
