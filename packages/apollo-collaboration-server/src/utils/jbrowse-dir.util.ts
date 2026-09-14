import path from 'node:path'

/**
 * Resolve the configured JBROWSE_DIR (typically relative, e.g. "./assets")
 * to an absolute path anchored at the package root. Anchoring here (rather
 * than at each call site) keeps the resolution identical no matter which
 * compiled file invokes it, since tsc mirrors `src`'s subfolder structure
 * under `dist` and this file always lives at `src/utils/`.
 */
export function resolveJBrowseDir(jbrowseDir: string): string {
  return path.join(import.meta.dirname, '..', '..', jbrowseDir)
}
