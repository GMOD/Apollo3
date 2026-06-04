# Login management

Apollo itself does not handle user logins. This lets us keep Apollo simpler and
more secure, since it doesn't store passwords, but means you'll have to set up
third-party logins through Google, Microsoft, or Login.gov.

Apollo also allows a single admin-level access root user with a password,
usually for use with the CLI, and a passwordless guest user with configurable
access level.

## Assembly ACL rollout

Apollo now supports assembly-level annotation permissions in addition to global
roles.

### Authorization model

- Global role still gates broad capabilities (`none`, `readOnly`, `user`,
  `admin`).
- Assembly permissions provide per-assembly view/edit grants.
- `admin` role bypasses assembly grants.
- `canEditAnnotations=true` always implies `canViewAnnotations=true`.

### Recommended rollout sequence

1. Verify at least one administrator account can access the server.
2. Upgrade Apollo server and plugin to versions that include assembly ACL
   support.
3. Seed permissions for existing users and required assemblies.
4. Validate read and write behavior using representative users before broad
   rollout.

### Seeding permissions with CLI

Use the CLI permissions commands as an admin:

```sh
apollo permissions grant -u admin@example.org -a myAssembly --edit
apollo permissions grant -u annotator@example.org -a myAssembly --edit
apollo permissions grant -u reviewer@example.org -a myAssembly --view
apollo permissions list -u reviewer@example.org
```

To remove access:

```sh
apollo permissions revoke -u reviewer@example.org -a myAssembly
```

### Backward compatibility notes

- Existing deployments remain role-based if assembly permissions are not
  created.
- Non-admin users without grants for a given assembly cannot read or write
  Apollo annotations for that assembly.
- Existing non-Apollo tracks remain unaffected by assembly ACL.

For a step-by-step production procedure, see
[Assembly ACL Rollout Runbook](./assembly-acl-rollout).

## Login.gov status

Login.gov support is scaffolded in Apollo3, but rollout should be treated as
pending until your final callback endpoint is registered/allowlisted with
Login.gov. Keep the provider disabled in production until endpoint approval is
complete.

In order to set up these logins, you'll need Apollo to be hosted at a domain
name that you own (e.g. the "Public IPv4 DNS" of an AWS EC2 instance will not
work).

## Set up Google login:

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
  `http://example.com`
- Enter the following as an authorized redirect URI, replacing the `example.com`
  with the correct value for your URL: `http://example.com/apollo/auth/google`
- Click "Create"
- Take note of Client ID and Client secret listed

Now that you have the client ID and secret, you'll need to add them to your
`apollo.env` file (or however else you are managing your Apollo environment
variables). The keys for these values are `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`. Make sure to restart the Apollo Collaboration Server
after updating these values.

## Set up Microsoft login (incomplete)

The guide for Microsoft logins is still in development and is incomplete. A
rough sketch for creating the necessary tokens is below. Microsoft logins,
however, require HTTPS access, and this section requires more work to lay out
the requirements and options of working with SSL certificates.

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
