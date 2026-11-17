/** @type {import('@yarnpkg/types')} */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { defineConfig } = require('@yarnpkg/types')

/**
 * This rule will enforce that a workspace MUST depend on the same version of
 * a dependency as the one used by the other workspaces.
 * Copied from {@link https://yarnpkg.com/features/constraints}.
 *
 *
 * @param {import('@yarnpkg/types').Yarn.Constraints.Context} context
 */
function enforceConsistentDependenciesAcrossTheProject({ Yarn }) {
  for (const dependency of Yarn.dependencies()) {
    if (dependency.type === 'peerDependencies') {
      continue
    }

    for (const otherDependency of Yarn.dependencies({
      ident: dependency.ident,
    })) {
      if (otherDependency.type === 'peerDependencies') {
        continue
      }

      dependency.update(otherDependency.range)
    }
  }
}

/**
 * Whether a workspace manifest is marked `"private": true`. The manifest is
 * typed as `any` by `@yarnpkg/types`, so narrow it from `unknown` here.
 *
 * @param {unknown} manifest
 * @returns {boolean}
 */
function isPrivate(manifest) {
  return (
    typeof manifest === 'object' &&
    manifest !== null &&
    'private' in manifest &&
    manifest.private === true
  )
}

/**
 * This rule will enforce that every published (non-private) workspace declares
 * the same license as the repository.
 *
 * @param {import('@yarnpkg/types').Yarn.Constraints.Context} context
 */
function enforceLicenseOnPublishedWorkspaces({ Yarn }) {
  for (const workspace of Yarn.workspaces()) {
    if (isPrivate(workspace.manifest)) {
      continue
    }
    workspace.set('license', 'Apache-2.0')
  }
}

/** @type {import('@yarnpkg/types').Yarn.Config} */
module.exports = defineConfig({
  constraints: (ctx) => {
    enforceConsistentDependenciesAcrossTheProject(ctx)
    enforceLicenseOnPublishedWorkspaces(ctx)
    return Promise.resolve()
  },
})
