# Apollo 3 Deployment

This guide will walk you through the deployment of a basic Apollo 3
installation. By the end of this guide you will be ready to start loading in
data and annotating in Apollo 3.

## Prerequisites

- A Linux server
  - Need terminal (SSH) and HTTP(S) access
- A domain name for the server
  - This guide assumes you are using the top level of the domain, so e.g. if
    your domain name is `example.com`, you won't be able to have Apollo be at
    `example.com/apollo`. Subdomains are fine, though, so you could use
    `apollo.example.com`
- Docker (with docker-compose)

Apollo 3 is not limited to running on Linux, but this guide assumes a Linux
environment for simplicity. Docker must be installed on the server, as well as
the Docker Compose plugin. Some systems install this plugin by default when
Docker is installed. You can check if the Compose plugin is installed by running
`docker compose version` and checking if it properly displays a version.

The process for getting and assigning a domain name to your server will vary
based on your setup, but if for example you are using AWS, you could use Route
53 to define an A type record that points to the public IP address of your EC2
instance.

## Initial setup

Create three files on your server called `apollo.env`, `docker-compose.yml`, and
`config.json`. The location of the files doesn't matter, and for this guide
we'll assume you've created them in a directory called `apollo/` in your home
directory.

```sh
cd ~
mkdir apollo
cd apollo/
touch docker-compose.yml apollo.env config.json
```

Using whatever file editing method you'd like, copy the contents of these sample
files into `apollo.env`, `docker-compose.yml`, and `config.json`:
[sample env file](./apollo.env),
[sample docker-compose file](./docker-compose.yml), and
[sample JBrowse config file](./config.json). Then we'll need to update a few
values in `apollo.env`. Where it says `URL=http://example.com`, replace
`http://example.com` with the URL of your server using the domain name mentioned
above. You'll also need to change `JWT_SECRET`. This value can be anything, but
it's best if it's a secure random value. One option is to use a password
generator to create a password to put here. The last value you'll need to change
is `SESSION_SECRET`. This should also be a random value, the same as
`JWT_SECRET`. All the other entries in this file can be left as they are for
now.

We'll also need to change a couple things in `config.json`. Under
"internetAccounts" where it says "baseURL", change it to the same URL you used
above with `:3999` appended to the end. For example:

```
"baseURL": "http://example.com:3999"
```

Then in the "plugins" section, change the "url" to that same URL with
`:9000/jbrowse-plugin-apollo.umd.production.min.js` appended to the end. For
example:

```
"url": "http://example.com:9000/jbrowse-plugin-apollo.umd.production.min.js"
```

## Starting Apollo

We're now ready to start Apollo. Inside your `~/apollo/` directory, run this
command:

```sh
docker compose up
```

You should see logs start to print to the screen as the various pieces start up.
Once you've confirmed that everything starts without errors, go ahead and press
<kbd>Ctrl</kbd> + <kbd>C</kbd> to stop everything. Now run a command very
similar to the one run before:

```sh
docker compose up -d
```

The `-d` instructs Docker to run in detached mode, so instead of seeing logs
printed to the screen, the command will exit, and Apollo is now running in the
background. You can see same logs as before by running

```sh
docker compose logs
```

And, you can stop Apollo by running

```sh
docker compose down
```

Next we need to copy the `config.json` file into the running Apollo app. We can
do this by running

```sh
docker compose cp ./config.json jbrowse-web:/usr/local/apache2/htdocs/
```

We are now ready to access Apollo. Open a web browser and got the URL you
entered in the `apollo.env` file above. You should see a JBrowse instance with a
prompt to log in with Google or Microsoft or to continue as a guest. We don't
have Google and Microsoft logins configured yet, so click "Log in as guest". You
should see a view with an assembly selector, but there aren't any assemblies
yet, so there's not much we can do for now.

## Configuring logins

We'll need to do some more setup to get regular Apollo logins working. As a
note, this is why a domain name is necessary. You can access Apollo using just
the public IP address of your server, but Google and Microsoft will not allow
you to configure a login for the server without a domain name.

The first thing you'll need to do is

### Set up Google login:

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
  with the correct value for your URL:
  `http://example.com:3999/auth/google`
- Click "Create"
- Take note of Client ID and Client secret listed

Now that you have the client ID and secret, you'll need to add them to your
`apollo.env` file. There are placeholders in the file for these in the file, so
you'll need to uncomment those lines (remove the `# ` from the beginning) and
fill in the correct values for `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Now restart the Docker Compose stack and re-copy `config.json` by running

```sh
docker compose restart
docker compose cp ./config.json jbrowse-web:/usr/local/apache2/htdocs/
```

Now when you refresh the page (you may need to clear your cache), you should be
able to log in with a Google account. The first user to log in automatically
becomes an admin user, and all following users get the role specified by
`DEFAULT_NEW_USER_ROLE` in `apollo.env`. By default, new users do not have any
role (not even read-only access) and must be assigned one by an admin.

At this point you can also make other changes to your `apollo.env` if you would
like, making sure to run `docker compose restart` to apply them. For example,
you can disable guest access, or change the role of guest users.

Congratulations! As an admin user, you can now start adding assemblies to Apollo
and start annotating!

### Set up Microsoft login (incomplete)

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
