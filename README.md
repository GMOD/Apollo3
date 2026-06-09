# Apollo3

Monorepo for Apollo3 development

## Current integration status (2026-06-09)

- Plugin authentication UX now surfaces failed local login attempts clearly
  instead of appearing to pass through.
- Apollo plugin menu now includes a visible signed-in indicator
  (`Signed in as: <username>` when available).
- Local USDA integration stack currently expects the plugin UMD bundle from
  `packages/jbrowse-plugin-apollo/dist/jbrowse-plugin-apollo.umd.development.js`.

## Local integration workflow

For the NAL local stack (served through `jbrowse-apollo-infra`):

1. Build shared package if needed:
   - `yarn --cwd packages/apollo-shared build`
2. Build plugin bundle:
   - `yarn --cwd packages/jbrowse-plugin-apollo build`
3. Start/restart infra stack from `../jbrowse-apollo-infra`:
   - `./scripts/dev/start_local_stack.sh`

## Where to look next

- Infrastructure status and run commands: `../jbrowse-apollo-infra/README.md`
- Active handoff notes and open risks:
  `../jbrowse-apollo-infra/HANDOFF_APOLLO3_JBROWSE2.md`

| Package                                                                | Description                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| [apollo-collaboration-server](./packages/apollo-collaboration-server/) | Server-side code                                           |
| [apollo-common](./packages/apollo-common/)                             | Public base classes for developers creating Apollo plugins |
| [apollo-mst](./packages/apollo-mst/)                                   | mobx-state-tree models                                     |
| [apollo-schemas](./packages/apollo-schemas/)                           | MongoDB schemas                                            |
| [apollo-shared](./packages/apollo-shared/)                             | Internal code shared between server and client             |
| [jbrowse-plugin-apollo](./packages/jbrowse-plugin-apollo/)             | Client-side code (as a JBrowse 2 plugin)                   |

See [the contribution guide](./CONTRIBUTING.md) for instructions to developers.
