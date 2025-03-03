// @ts-check

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

module.exports = defineConfig({
  constraints: (ctx) => {
    enforceConsistentDependenciesAcrossTheProject(ctx)
    return Promise.resolve()
  },
})
