# Local development

This documentation assumes both `jbrowse-components` and `Apollo3` are cloned
side-by-side:

```sh
git clone https://github.com/GMOD/jbrowse-components
git clone https://github.com/GMOD/Apollo3
```

You'll need `yarn` to be installed.

You then have two options to start Apollo3 for development purposes. In both
cases, the instance is then accessible via

http://localhost:3000/?config=http://localhost:3999/jbrowse/config.json

## In a container via Visual Studio Code

If you use Visual Studio Code, you can leverage the _Dev Containers_ extension.
You'll need `docker` to be installed.

- Open the Apollo3 project in Visual Studio Code.
- Use the _Dev Containers: Reopen in Container_ command in VS Code
  (`Ctrl + Shift + P` to search for commands).
- Build: Run `yarn` at the root of this repositories (`pnpm install` for
  jbrowse-components), this only needs to be ran once after cloning
  (alternatively, run the `just setup` recipe, see below).
- Run FE: `pnpm start` from `jbrowse-components/products/jbrowse-web`
  (alternatively, run the `just run-jbrowse` recipe).
- Use the _Task: Run Task -> Start_ command in VS Code

## Directly on the development computer

You'll need a MongoDB server running. For convenience, a `justfile` leveraging
[the `just` command runner](https://just.systems/man/en/) is provided. `just`
commands can be executed from anywhere within your local clone of `Apollo3`. You
can run `just` to get a list of available recipes.

- Run `just setup` (only once after cloning).
- Run `just run` (this automatically starts `jbrowse` and the Apollo
  components).

You can also define your own recipes in a `user.just` file, they will be added
to the list of available recipes. For instance, on a Linux system, you might
find the following recipes useful to have in your `user.just` file:

```just
# start mongodb server
start-mongodb:
    sudo systemctl start mongodb.service

# open in browser
open:
    xdg-open http://localhost:3000/?config=http://localhost:3999/jbrowse/config.json
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

## Optional: Google and Microsoft login for local development

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
