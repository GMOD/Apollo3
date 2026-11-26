# Website

The source for [apollo.jbrowse.org](https://apollo.jbrowse.org), built with
[Docusaurus](https://docusaurus.io/).

Run `yarn` once at the root of the repository to install dependencies.

## Local development

```sh
yarn workspace @apollo-annotation/website start
```

This starts a local development server and opens a browser window. Most changes
show up without restarting the server.

## Build

```sh
yarn workspace @apollo-annotation/website build
```

This writes the static site to `build/`. Pull requests check that the site
builds.

## Generated content

Don't edit these docs by hand:

- **CLI reference** (`docs/03-multi-user/03-guides/04-cli/`): the CLI's
  `version` script regenerates it from the commands in `packages/apollo-cli`.
- **REST API reference**: `yarn gen-api-docs` generates it from the
  collaboration server's OpenAPI spec.

## Deployment

The site deploys to AWS (S3 and CloudFront) through the "Deploy Docusaurus to
website" GitHub Actions workflow (`.github/workflows/website.yml`). Run it from
the Actions tab. Don't use `yarn deploy`: it's Docusaurus's GitHub Pages deploy,
which this site doesn't use.
