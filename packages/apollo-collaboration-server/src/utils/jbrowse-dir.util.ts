import path from 'node:path'

/**
 * Resolve the configured JBROWSE_DIR to an absolute path. A relative one
 * (e.g. "./assets") is anchored at the package root, an absolute one (e.g. in
 * a container) is used as is. Anchoring here (rather
 * than at each call site) keeps the resolution identical no matter which
 * compiled file invokes it, since tsc mirrors `src`'s subfolder structure
 * under `dist` and this file always lives at `src/utils/`.
 */
export function resolveJBrowseDir(jbrowseDir: string): string {
  return path.resolve(import.meta.dirname, '..', '..', jbrowseDir)
}
