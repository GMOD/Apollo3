/**
 * Pre-commit hook to format changed non-JS/TS files
 * JS/TS files ignored since ESLint provides formatting feedback for those
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires, no-undef
const spawn = require('cross-spawn')

function main() {
  // Get names of files that were changed
  const changedFiles = spawn
    .sync('git', ['diff', '--cached', '--name-status'])
    .stdout.toString()
    .trim()
    .split(/[\n\r]+/)
    // Ignore deleted files
    .map((line) => (line.startsWith('D\t') ? undefined : line.split('\t')[1]))
    .filter(Boolean)

  if (changedFiles.some((fileName) => fileName.includes('apollo-cli'))) {
    spawn.sync('yarn', ['workspace', 'apollo-cli', 'build'], {
      stdio: 'inherit',
    })
    spawn.sync('yarn', ['workspace', 'apollo-cli', 'oclif', 'readme'], {
      stdio: 'inherit',
    })
    if (!changedFiles.includes('packages/apollo-cli/README.md')) {
      changedFiles.push('packages/apollo-cli/README.md')
    }
  }

  // Filter out JS/TS files
  const filesToFormat = changedFiles.filter(
    (fileName) => !isJSOrTSFile(fileName),
  )

  // Run prettier formatting on non-JS/TS files
  if (filesToFormat.length > 0) {
    spawn.sync(
      'yarn',
      ['prettier', ...filesToFormat, '--write', '--ignore-unknown'],
      { stdio: 'inherit' },
    )
    spawn.sync('git', ['add', ...filesToFormat], { stdio: 'inherit' })
  }
}

function isJSOrTSFile(fileName) {
  return (
    fileName.endsWith('.js') ||
    fileName.endsWith('.jsx') ||
    fileName.endsWith('.ts') ||
    fileName.endsWith('tsx')
  )
}

main()
