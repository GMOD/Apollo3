# Quick start with `apollo setup`

The `apollo setup` command installs and configures an Apollo collaboration
server for you. It asks a few questions, downloads and builds the server, adds
the Apollo plugin to your JBrowse, writes the server's `.env` settings file, and
prints how to start the server.

It works on Linux, macOS and Windows.

## Prerequisites

- Node.js 20 or later
- About 4 GB of free disk space for the build
- A JBrowse Web installation with at least one config file. Apollo adds to an
  existing JBrowse rather than installing one, so if you're new to JBrowse,
  start with the [JBrowse CLI](https://jbrowse.org/jb2/docs/cli/):

  ```sh
  npm install -g @jbrowse/cli
  jbrowse create /var/www/jbrowse
  cd /var/www/jbrowse
  jbrowse add-assembly https://example.org/genome.fa --load copy
  ```

  The assemblies in the JBrowse config file are the assemblies Apollo users can
  annotate.

- Either an existing MongoDB server, or nothing. Setup can use an embedded
  MongoDB instead, which is fine for trying Apollo out or for small installs,
  but not for production.

## Running setup

Install the Apollo CLI and run setup:

```sh
npm install -g @apollo-annotation/cli
apollo setup
```

Setup asks for:

1. **Install directory**: where Apollo is installed, e.g. `/opt/apollo`
2. **Apollo version**: defaults to the CLI's version
3. **JBrowse Web directory**: your existing JBrowse
4. **JBrowse config file(s)**: one or more config files in that directory, e.g.
   `config.json` or `config.json,config_mouse.json`
5. **Public URL and port**: the URL users will open, and the port the server
   listens on
6. **Server name and description**
7. **MongoDB**: the URI of your MongoDB server, or the embedded MongoDB
8. **Login methods**: a root user (for admins and the CLI), a guest user, and
   Google or Microsoft logins. Setup prints the redirect URI to register with
   Google or Microsoft. For other OpenID Connect providers, see
   [Login management](../login-management).
9. **First admin's email and the role for new users**
10. **Upload directory**: where uploaded files are stored

It then shows a summary and asks you to confirm before it changes anything. Use
`--dry-run` to see the summary and the `.env` file without writing anything.

Every question has a matching flag, so setup can also run without questions:

```sh
apollo setup --yes \
  --install-dir /opt/apollo \
  --jbrowse-dir /var/www/jbrowse \
  --url https://apollo.example.org \
  --mongodb existing --mongodb-uri mongodb://localhost:27017/apolloDb
```

Run `apollo setup --help` for the full list of flags.

## What setup changes

In the install directory:

```
/opt/apollo/
  .env                  the server's settings (contains secrets, so keep it private)
  start-apollo.sh       starts the server (start-apollo.cmd on Windows)
  current               link to the active release
  releases/v<version>/  the built server for each installed version
  uploads/              uploaded files
  data/mongodb/         embedded MongoDB data, if used
  mongodb-binaries/     embedded MongoDB program, if used
```

In the JBrowse directory, setup only adds files. It never overwrites a file and
never changes a config file:

- `apollo-v<version>.js`: the Apollo plugin
- `sequence_ontology.json`: the Sequence Ontology, unless you already have this
  file

The server adds the Apollo settings to your JBrowse config files when it serves
them, so you don't need to edit them yourself.

The `.env` file holds the [configuration options](../configuration-options). You
can edit it, then restart the server for the changes to take effect.

## Starting Apollo

Start the server with:

```sh
/opt/apollo/start-apollo.sh
```

Then open the public URL. Setup also prints a systemd service and a PM2 command
for running the server in the background. See
[Running several server processes with PM2](./pm2) for more.

Before using Apollo in production, put a reverse proxy with TLS (HTTPS) in front
of the server, as described in the [Ubuntu example](./ubuntu-server), and switch
from the embedded MongoDB to a real MongoDB server.

## Upgrading and rolling back

To upgrade, run setup again with the same install directory and a newer version:

```sh
apollo setup --install-dir /opt/apollo --apollo-version <new version>
```

Your previous answers are the defaults, and the secrets in `.env` are kept, as
are any settings you added to `.env` yourself. Setup installs the new version
next to the old one and switches `current` to it. Stop the server before
upgrading and start it again afterwards.

To roll back, run setup with the older version. Since that version is already
built, setup just switches back to it. You can delete old versions from
`releases/` and old `apollo-v*.js` files from the JBrowse directory once you no
longer need them.
