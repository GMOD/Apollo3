# Login management

Apollo itself does not handle user logins. This lets us keep Apollo simpler and
more secure, since it doesn't store passwords, but means you'll have to set up
third-party logins through Google or Microsoft.

Apollo also allows a single admin-level access root user with a password,
usually for use with the CLI, and a passwordless guest user with configurable
access level.

In order to set up these logins, you'll need Apollo to be hosted at a domain
name that you own with HTTPS enabled (e.g. the "Public IPv4 DNS" of an AWS EC2
instance will not work).

:::caution HTTPS is required for OAuth Google and Microsoft both require HTTPS
for OAuth redirect URIs in production deployments. OAuth login will **not work**
over plain HTTP. If you are deploying Apollo to a public server, you **must**
configure TLS/SSL before enabling Google or Microsoft login. See the
[SSL/TLS setup section](#ssltls-setup-for-production) below for guidance. :::

## Set up Google login

We'll start by configuring Google. You'll need to use a Google account to create
a "client ID" and "client secret" for your Apollo instance. Here is how to set
up authentication with Google and get those values.

- Go to https://console.developers.google.com/
- Log in
- To the left of the search, click on the project selector dropdown
- Click "New project", enter a "Project name" and "Location"
- Once in the project, click the top left hamburger menu -> "APIs & Services" ->
  "Credentials"
- Click "+ Create Credentials" at the top, select "OAuth client ID"
- Select application type "Web application"
- Give it a name (e.g. MyOrg's Apollo)
- Enter the URL of your app as an authorized JavaScript origin, e.g.
  `https://example.com`
- Enter the following as an authorized redirect URI, replacing the `example.com`
  with the correct value for your URL: `https://example.com/apollo/auth/google`
- Click "Create"
- Take note of Client ID and Client secret listed

Now that you have the client ID and secret, you'll need to add them to your
`apollo.env` file (or however else you are managing your Apollo environment
variables). The keys for these values are `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`. Make sure to restart the Apollo Collaboration Server
after updating these values.

## Set up Microsoft login (incomplete)

The guide for Microsoft logins is still in development and is incomplete. A
rough sketch for creating the necessary tokens is below. Microsoft logins also
require HTTPS access (see the
[SSL/TLS setup section](#ssltls-setup-for-production) below).

- Go to
  https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
- Log in
- Click "New registration"
- Give the app a name
- Select supported account types (suggest "Accounts in any organizational
  directory (Any Azure AD directory - Multitenant) and personal Microsoft
  accounts (e.g. Skype, Xbox)")
  - Could be either or depending on use case
- Click "Register"
- Note Application (client) ID
- Go to new app's details
- Under "Client credentials" click "Add a certificate or secret"
- Click "New client secret"
- Enter a description and an expiration date
  - Note the expiration date so you can rotate keys before then
- Note newly registered client secret (Value, not Secret ID)

Now that you have the client ID and secret, you'll need to add them to your
`apollo.env` file (or however else you are managing your Apollo environment
variables). The keys for these values are `MICROSOFT_CLIENT_ID` and
`MICROSOFT_CLIENT_SECRET`. Make sure to restart the Apollo Collaboration Server
after updating these values.

## SSL/TLS setup for production

Google OAuth and Microsoft OAuth both require HTTPS for deployed applications.
While `localhost` may work for local development, any server accessed over a
public network **must** use HTTPS.

### Using a reverse proxy (recommended)

The most common approach is to run Apollo behind a reverse proxy such as
[NGINX](https://nginx.org/) or [Caddy](https://caddyserver.com/) that handles
TLS termination. The proxy terminates HTTPS and forwards traffic to Apollo over
HTTP on localhost.

#### NGINX example

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3999;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Caddy example

Caddy automatically provisions and renews TLS certificates:

```
example.com {
    reverse_proxy localhost:3999
}
```

### Using Let's Encrypt directly

[Certbot](https://certbot.eff.org/) can obtain and renew free TLS certificates
from Let's Encrypt. Once you have a certificate, configure your reverse proxy as
shown above.

### WebSocket traffic

Apollo uses WebSockets for real-time collaboration. When using a reverse proxy,
make sure WebSocket connections are properly forwarded (the `Upgrade` and
`Connection` headers in the NGINX example above handle this). You can verify
WebSockets are working by opening Apollo in two browsers and confirming that
annotation changes in one browser appear immediately in the other.

### Updating your `URL` environment variable

When using HTTPS, make sure the `URL` variable in your `apollo.env` file uses
the `https://` scheme:

```
URL=https://example.com
```
