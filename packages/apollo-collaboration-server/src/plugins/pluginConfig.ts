/** Parsing for the plugin-related environment variables, shared by the config
 * validation schema and `PluginsModule` so they can't disagree. */

/** Split a comma-separated list, trimming entries and dropping empty ones */
export function parseCommaSeparatedList(value?: string): string[] {
  if (!value) {
    return []
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

const SHA256_HEX = /^[\da-f]{64}$/

/**
 * Parse `PLUGIN_INTEGRITY`, a comma-separated list of `url=sha256` pairs, into
 * a map of URL to lowercase hex hash. The hash is taken from after the *last*
 * `=`, so URLs with query strings work.
 *
 * Throws if an entry is malformed.
 */
export function parsePluginIntegrity(value?: string): Map<string, string> {
  const integrity = new Map<string, string>()
  for (const entry of parseCommaSeparatedList(value)) {
    const separatorIndex = entry.lastIndexOf('=')
    const url = entry.slice(0, Math.max(0, separatorIndex)).trim()
    const hash = entry
      .slice(separatorIndex + 1)
      .trim()
      .toLowerCase()
    if (separatorIndex === -1 || !url || !SHA256_HEX.test(hash)) {
      throw new Error(
        `Invalid PLUGIN_INTEGRITY entry "${entry}": expected "<url>=<sha256 hex>"`,
      )
    }
    integrity.set(url, hash)
  }
  return integrity
}
