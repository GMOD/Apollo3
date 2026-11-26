# Local development

Apollo has three parts that run during development:

- the collaboration server (`packages/apollo-collaboration-server`) on port
  3999, which needs MongoDB on port 27017
- the JBrowse plugin (`packages/jbrowse-plugin-apollo`), built in watch mode and
  served on port 9000
- JBrowse Web itself, which loads the plugin through the server's
  `/jbrowse/config.json`

`packages/apollo-shared` is also built in watch mode, since the server and the
plugin both use it.

This repository uses Yarn workspaces. See [AGENTS.md](AGENTS.md) for the rules
on running commands and adding dependencies.

## In a container via Visual Studio Code

This is the easiest setup. You need Docker and the VS Code _Dev Containers_
extension. The container includes Node.js and a MongoDB server, and runs
`yarn install` when it's created.

1. Open the Apollo3 project in VS Code.
2. Run _Dev Containers: Reopen in Container_ (`Ctrl + Shift + P` to search for
   commands).
3. Install JBrowse Web into `packages/jbrowse-plugin-apollo/.jbrowse/`: run
   _Tasks: Run Task_, then `jbrowse: install version`, and choose a version. You
   only need to do this once, or when you want a different JBrowse version.
4. Run _Tasks: Run Task_, then `Start: dev`. This starts the shared package, the
   collaboration server, and the plugin.
5. Run _Tasks: Run Task_, then `jbrowse: server`. This serves JBrowse on
   port 8999.

Then open
http://localhost:8999/?config=http://localhost:3999/jbrowse/config.json

Other tasks start what the tests need: `Start: e2e` for the Cypress tests (see
[the plugin README](packages/jbrowse-plugin-apollo/README.md)) and
`Start: CLI tests` for the CLI tests (see
[the CLI test README](packages/apollo-cli/src/test/README.md)).

## Directly on the development computer

You need Node.js (the version in `.nvmrc`), Yarn (run `corepack enable` to get
the version this repository pins), and a MongoDB server on port 27017. The dev
container runs MongoDB 8 as a single-node replica set (see
`.devcontainer/compose.yml`).

Install dependencies and JBrowse Web once after cloning:

```sh
yarn
cp packages/apollo-collaboration-server/.development.local.env.example \
  packages/apollo-collaboration-server/.development.local.env
yarn workspace @apollo-annotation/jbrowse-plugin-apollo setup
```

Then start each part in its own terminal:

```sh
yarn workspace @apollo-annotation/shared start
```

```sh
yarn workspace @apollo-annotation/collaboration-server start
```

```sh
yarn workspace @apollo-annotation/jbrowse-plugin-apollo start
```

```sh
yarn workspace @apollo-annotation/jbrowse-plugin-apollo browse
```

Then open
http://localhost:8999/?config=http://localhost:3999/jbrowse/config.json

### Using `just`

A `justfile` for [the `just` command runner](https://just.systems/man/en/) does
the same steps for you. `just` commands work from anywhere in your clone.

- Run `just setup` once after cloning. It installs dependencies, creates
  `.development.local.env`, and installs the latest JBrowse Web release into
  `packages/jbrowse-plugin-apollo/.jbrowse/` if it isn't there yet. To change
  the JBrowse version later, use the `jbrowse: install version` VS Code task or
  `yarn jbrowse upgrade .jbrowse` in `packages/jbrowse-plugin-apollo`.
- Run `just run` to start JBrowse and all the Apollo parts, then open
  http://localhost:8999/?config=http://localhost:3999/jbrowse/config.json

Run `just` to list the recipes. You can add your own in a `user.just` file. For
example, on Linux:

```just
# start mongodb server
start-mongodb:
    sudo systemctl start mongodb.service

# open in browser
open:
    xdg-open http://localhost:8999/?config=http://localhost:3999/jbrowse/config.json
```

## Local configuration overrides

The collaboration server's development configuration lives in
`packages/apollo-collaboration-server/.development.env`, which is committed. To
change any of those values for your own setup, put them in
`packages/apollo-collaboration-server/.development.local.env` instead. That file
is gitignored, and any value in it takes precedence over `.development.env`.
`just setup` creates it for you from
`packages/apollo-collaboration-server/.development.local.env.example`, or you
can copy that file yourself.

The server doesn't watch these files, so restart it after editing them.

## Optional: Google, Microsoft, or other OIDC login for local development

You don't need this for most development: the guest user and root user (see
`.development.env`) both work out of the box. If you're working on login, you
can create your own OAuth credentials and put them in `.development.local.env`.

### Google

Follow the
[Google login instructions](packages/website/docs/03-multi-user/02-installation/03-login-management.md#set-up-google-login),
with these values for local development:

- Authorized JavaScript origin: `http://localhost:3999`
- Authorized redirect URI: `http://localhost:3999/auth/google`

On the OAuth consent screen, leave the app in "Testing" mode and add your own
Google account as a test user. Then add the values to `.development.local.env`:

```sh
GOOGLE_CLIENT_ID=<your client ID>
GOOGLE_CLIENT_SECRET=<your client secret>
```

### Microsoft

Follow the
[Microsoft login instructions](packages/website/docs/03-multi-user/02-installation/03-login-management.md#set-up-microsoft-login-incomplete).
Under "Redirect URI", choose the "Web" platform and enter
`http://localhost:3999/auth/microsoft`. Microsoft allows plain HTTP for
`localhost`, so you don't need HTTPS for local development. Then add the values
to `.development.local.env`:

```sh
MICROSOFT_CLIENT_ID=<your application (client) ID>
MICROSOFT_CLIENT_SECRET=<your client secret value>
```

### Other OpenID Connect providers

Follow the
[OpenID Connect instructions](packages/website/docs/03-multi-user/02-installation/03-login-management.md#set-up-any-openid-connect-provider),
with `http://localhost:3999/auth/<name>` as the redirect URI. For a provider
running locally (e.g. Keycloak in a container), the issuer can use plain
`http://`. The server logs a warning, but allows it.

```sh
OIDC_PROVIDERS=keycloak
OIDC_KEYCLOAK_ISSUER=http://localhost:8080/realms/apollo
OIDC_KEYCLOAK_CLIENT_ID=<your client ID>
OIDC_KEYCLOAK_CLIENT_SECRET=<your client secret>
```
