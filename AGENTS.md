# AGENTS.md

## Package management: Yarn 4 workspaces only

This repo is a monorepo managed with Yarn 4 (Berry) workspaces, using
Plug'n'Play (PnP). The Yarn version is pinned in `.yarnrc.yml` (`yarnPath`) and
`package.json` (`packageManager`).

- Use `yarn` for everything. Never use `npm`, `npx`, `pnpm`, or `bun`, and never
  create `package-lock.json` or `pnpm-lock.yaml`.
- Packages aren't installed in `node_modules` (it only holds tool caches).
  Dependencies resolve through `.pnp.cjs`. Don't try to fix missing modules by
  creating `node_modules`, changing `nodeLinker`, or adding paths by hand.
- Run Node and Node tools through Yarn so PnP is active: `yarn node`,
  `yarn tsc`, `yarn eslint`, `yarn tsx script.ts`. Use `yarn dlx <pkg>` instead
  of `npx <pkg>`.

### Adding or changing dependencies

- Add a dependency to the package that uses it, not the root:
  `yarn workspace @apollo-annotation/<name> add <pkg>` (`add -D` for dev
  dependencies). Root `devDependencies` are for repo-wide tooling only.
- Depend on another workspace with the `workspace:` protocol, e.g.
  `"@apollo-annotation/shared": "workspace:^"`.
- Commit `yarn.lock` changes together with the `package.json` changes that
  caused them. Don't edit `yarn.lock` by hand.
- `.yarnrc.yml` sets `npmMinimalAgeGate`, so Yarn refuses package versions
  published less than two days ago. Pick an older version rather than changing
  the setting.
- Constraints in `yarn.config.cjs` are enforced. After changing any
  `package.json`, run `yarn constraints` (and `yarn constraints --fix` to apply
  automatic fixes).

## Commit messages

When you write or help write a commit, credit yourself with an `Assisted-by`
trailer. Don't use `Co-authored-by` for AI assistance. That trailer is only for
human co-authors.

```text
Assisted-by: <agent name>:<model ID>
```

For example: `Assisted-by: Claude Code:claude-opus-5-5`. Put it in the trailer
block at the end of the message, after a blank line.
