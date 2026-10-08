// Rewrites Yarn PnP virtual paths in raw V8 coverage files to real paths.
//
// Workspaces with peer dependencies (e.g. apollo-shared) are loaded from paths
// like `.yarn/__virtual__/<name>-virtual-<hash>/1/packages/apollo-shared/...`,
// which don't match c8's include globs. The number after the hash is how many
// directories to go up from `.yarn/__virtual__/` before appending the rest.
//
// Usage: tsx scripts/normalizeV8Coverage.ts <coverage temp directory>

import fs from 'node:fs'
import path from 'node:path'

const virtualPath = /\/\.yarn\/__virtual__\/[^/]+\/(\d+)\//g

function toRealPath(url: string) {
  return url.replaceAll(virtualPath, (_match, depth: string) => {
    const up = Number(depth) + 1 // +1 for the `__virtual__` directory itself
    return `/.yarn/__virtual__/${'../'.repeat(up)}`
  })
}

function normalizeURL(url: string) {
  if (!url.startsWith('file://')) {
    return url
  }
  return `file://${path.posix.normalize(toRealPath(url.slice('file://'.length)))}`
}

interface V8Coverage {
  result: { url: string }[]
  'source-map-cache'?: Record<string, unknown>
}

const [directory] = process.argv.slice(2)
if (!directory) {
  throw new Error('Usage: tsx scripts/normalizeV8Coverage.ts <directory>')
}

for (const file of fs.readdirSync(directory)) {
  if (!file.endsWith('.json')) {
    continue
  }
  const filePath = path.join(directory, file)
  const coverage = JSON.parse(fs.readFileSync(filePath, 'utf8')) as V8Coverage
  for (const script of coverage.result) {
    script.url = normalizeURL(script.url)
  }
  const sourceMapCache = coverage['source-map-cache']
  if (sourceMapCache) {
    coverage['source-map-cache'] = Object.fromEntries(
      Object.entries(sourceMapCache).map(([url, sourceMap]) => [
        normalizeURL(url),
        sourceMap,
      ]),
    )
  }
  fs.writeFileSync(filePath, JSON.stringify(coverage))
}
