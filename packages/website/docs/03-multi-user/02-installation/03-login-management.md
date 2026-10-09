# Login management

Apollo itself does not handle user logins. This lets us keep Apollo simpler and
more secure, since it doesn't store passwords, but means you'll have to set up
third-party logins. Apollo can use any login provider that supports
[OpenID Connect](https://openid.net/developers/how-connect-works/) (OIDC), such
as Keycloak, Okta, Auth0, GitLab, or your institution's single sign-on. Google
and Microsoft are built in, so they only need a client ID and secret.

Apollo also allows a single admin-level access root user with a password,
usually for use with the CLI, and a passwordless guest user with configurable
access level.

In order to set up these logins, you'll need Apollo to be hosted at a domain
name that you own (e.g. the "Public IPv4 DNS" of an AWS EC2 instance will not
work).

## Set up Google login:

Follow the instructions here to create a new Google OAuth client:

https://support.google.com/cloud/answer/15549257

For the redirect URI, use `http://{your_url}/apollo/auth/google`. When you're
finished, take note of your client ID and client secret. You'll add these to
your `apollo.env` file (or however else you are managing your Apollo environment
variables). The keys for these values are `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`. Make sure to restart the Apollo Collaboration Server
after updating these values.

## Set up Microsoft login (incomplete)

Follow the instructions here to create a new Microsoft OAuth client:

https://learn.microsoft.com/en-us/azure/active-directory-b2c/tutorial-register-applications

For the redirect URI, use `http://{your_url}/apollo/auth/microsoft`. When you're
finished, take note of your client ID and client secret. You'll add these to
your `apollo.env` file (or however else you are managing your Apollo environment
variables). The keys for these values are `MICROSOFT_CLIENT_ID` and
`MICROSOFT_CLIENT_SECRET`. By default, anyone with a Microsoft account can log
in. To only allow accounts from your organization, set `MICROSOFT_TENANT` to
your directory (tenant) ID. Make sure to restart the Apollo Collaboration Server
after updating these values.

## Set up any OpenID Connect provider

Register Apollo as a new client (sometimes called an "application") with your
login provider. Choose a short name for the provider, using only letters,
numbers, and underscores, e.g. `keycloak`. The name can't be `login`, `types`,
`guest`, or `root`, or one already used by another login type. For the redirect
URI, use `http://{your_url}/apollo/auth/{name}`, e.g.
`http://{your_url}/apollo/auth/keycloak`. When you're finished, take note of
your issuer URL, client ID, and client secret. The issuer URL is the address
your provider publishes its configuration under, e.g.
`https://sso.example.org/realms/apollo` for Keycloak. Apollo looks it up at
`{issuer}/.well-known/openid-configuration`.

Add the name to `OIDC_PROVIDERS` and the values to your `apollo.env` file, using
the name in upper case in each key:

```sh
OIDC_PROVIDERS=keycloak
OIDC_KEYCLOAK_ISSUER=https://sso.example.org/realms/apollo
OIDC_KEYCLOAK_CLIENT_ID=client_id_here
OIDC_KEYCLOAK_CLIENT_SECRET=client_secret_here
# Optional: the login button will say "Sign in with University SSO"
OIDC_KEYCLOAK_DISPLAY_NAME=University SSO
```

To set up more than one provider, separate the names with commas in
`OIDC_PROVIDERS` and add a set of keys for each one. Apollo requests the
`openid email profile` scopes and identifies users by their email address, so
the provider has to return an email for each user. Make sure to restart the
Apollo Collaboration Server after updating these values.
