// Summarizes coverage from each test suite's lcov report as a Markdown table of
// line coverage per source directory and suite, followed by lists of files no
// suite covers and files only the integration suites (CLI, e2e) cover.
//
// Run the suites first (see each package's test:ci and coverage scripts), then:
//   yarn tsx scripts/coverageMatrix.ts > coverage/matrix.md
//
// Percentages come from each tool as-is. c8 (V8) counts every line of a file
// while istanbul (jest, nyc) counts only statement lines, so compare them
// within a column, not across columns. The file lists only use whether a file
// was hit at all, which is comparable across tools.

import fs from 'node:fs'

const suites: Record<string, string[]> = {
  'unit-shared': ['packages/apollo-shared/coverage/lcov.info'],
  'unit-plugin': ['packages/jbrowse-plugin-apollo/coverage/lcov.info'],
  'unit-server': ['packages/apollo-collaboration-server/coverage/lcov.info'],
  cli: ['coverage/cli/lcov.info'],
  e2e: ['coverage/e2e-browser/lcov.info', 'coverage/e2e-server/lcov.info'],
}
const integrationSuites = new Set(['cli', 'e2e'])
// The server's unit specs only check that each service can be constructed, so
// they "hit" every file they import. Leave them out of the file lists.
const smokeSuites = new Set(['unit-server'])

// file -> line number -> hit count
type FileCoverage = Map<number, number>

function parseLcov(lcovPath: string) {
  const files = new Map<string, FileCoverage>()
  let current: FileCoverage | undefined
  for (const line of fs.readFileSync(lcovPath, 'utf8').split('\n')) {
    if (line.startsWith('SF:')) {
      current = new Map()
      files.set(line.slice(3), current)
    } else if (line.startsWith('DA:') && current) {
      const [lineNumber, hits] = line.slice(3).split(',').map(Number)
      if (lineNumber !== undefined && hits !== undefined) {
        current.set(lineNumber, Math.max(hits, current.get(lineNumber) ?? 0))
      }
    }
  }
  return files
}

function directoryOf(file: string) {
  // packages/<package>/src/<directory>/... or packages/<package>/src/<file>
  const parts = file.split('/')
  return parts.length > 4
    ? parts.slice(0, 4).join('/')
    : parts.slice(0, 3).join('/')
}

function percent(hit: number, total: number) {
  return total === 0 ? '-' : `${((100 * hit) / total).toFixed(1)}%`
}

const coverageBySuite = new Map<string, Map<string, FileCoverage>>()
const missing: string[] = []
for (const [suite, lcovPaths] of Object.entries(suites)) {
  const files = new Map<string, FileCoverage>()
  for (const lcovPath of lcovPaths) {
    if (!fs.existsSync(lcovPath)) {
      missing.push(`${suite} (${lcovPath})`)
      continue
    }
    for (const [file, lines] of parseLcov(lcovPath)) {
      files.set(file, lines)
    }
  }
  if (files.size > 0) {
    coverageBySuite.set(suite, files)
  }
}

const suiteNames = [...coverageBySuite.keys()]
const allFiles = new Set<string>()
for (const files of coverageBySuite.values()) {
  for (const file of files.keys()) {
    allFiles.add(file)
  }
}

function isHit(lines: FileCoverage | undefined) {
  return lines ? [...lines.values()].some((hits) => hits > 0) : false
}

// Directory table
const directories = [
  ...new Set([...allFiles].map((file) => directoryOf(file))),
].sort()
const output: string[] = [
  '# Coverage by directory and suite',
  '',
  `| Directory | ${suiteNames.map((suite) => (smokeSuites.has(suite) ? `${suite} (smoke only)` : suite)).join(' | ')} |`,
  `| --- | ${suiteNames.map(() => '---:').join(' | ')} |`,
]
for (const directory of directories) {
  const cells = suiteNames.map((suite) => {
    let hit = 0
    let total = 0
    for (const [file, lines] of coverageBySuite.get(suite) ?? []) {
      if (directoryOf(file) !== directory) {
        continue
      }
      total += lines.size
      hit += [...lines.values()].filter((hits) => hits > 0).length
    }
    return percent(hit, total)
  })
  output.push(`| ${directory} | ${cells.join(' | ')} |`)
}

// File lists
const notCovered: string[] = []
const integrationOnly: string[] = []
for (const file of [...allFiles].sort()) {
  const hitBy = suiteNames.filter(
    (suite) =>
      !smokeSuites.has(suite) && isHit(coverageBySuite.get(suite)?.get(file)),
  )
  if (hitBy.length === 0) {
    notCovered.push(file)
  } else if (hitBy.every((suite) => integrationSuites.has(suite))) {
    integrationOnly.push(`${file} (${hitBy.join(', ')})`)
  }
}
output.push(
  '',
  `## Files no suite covers (${notCovered.length})`,
  '',
  ...notCovered.map((file) => `- ${file}`),
  '',
  `## Files only integration suites cover (${integrationOnly.length})`,
  '',
  ...integrationOnly.map((file) => `- ${file}`),
)
if (missing.length > 0) {
  output.push(
    '',
    '## Missing reports',
    '',
    ...missing.map((report) => `- ${report}`),
  )
}

process.stdout.write(`${output.join('\n')}\n`)
