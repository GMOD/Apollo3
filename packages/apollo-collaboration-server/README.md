# apollo-collaboration-server

The [Apollo](https://apollo.jbrowse.org) collaboration server lets a team
annotate the same genomes together in real time. It's a
[NestJS](https://nestjs.com/) app that stores assemblies, features and the
changelog in MongoDB. It serves a REST API, sends each change to every connected
client over WebSockets, and serves the JBrowse configuration that loads the
Apollo plugin.

## Running a server

This package isn't published to npm. To run a server, use the Docker image
`ghcr.io/gmod/apollo-collaboration-server` and follow the
[installation guide](https://apollo.jbrowse.org/docs/multi-user/installation/background).
The
[local demo](https://apollo.jbrowse.org/docs/multi-user/local-demo/setting-up)
is a quick way to try one. The
[REST API reference](https://apollo.jbrowse.org/docs/multi-user/guides/rest-api)
documents the API.

## Development

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for how to run the server locally,
and how to override settings from `.development.env` in a
`.development.local.env` file.

```sh
# Start the server, rebuilding on changes
yarn workspace @apollo-annotation/collaboration-server start

# Unit tests
yarn workspace @apollo-annotation/collaboration-server test

# Regenerate openapi.json, which the website's REST API reference uses
yarn workspace @apollo-annotation/collaboration-server openapi
```

The `cypress:start` and `test:cli:start` scripts start the server with the
settings the Cypress and CLI tests expect. See the
[plugin README](../jbrowse-plugin-apollo/README.md) and the
[CLI test README](../apollo-cli/src/test/README.md).
