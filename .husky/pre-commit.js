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

  if (
    changedFiles.some(
      (fileName) =>
        fileName.includes('apollo-cli') && !fileName.includes('test'),
    )
  ) {
    spawn.sync('yarn', ['workspace', '@apollo-annotation/cli', 'build'], {
      stdio: 'inherit',
    })
    spawn.sync(
      'yarn',
      ['workspace', '@apollo-annotation/cli', 'oclif', 'readme'],
      { stdio: 'inherit' },
    )
    spawn.sync(
      'yarn',
      [
        'workspace',
        '@apollo-annotation/cli',
        'oclif',
        'readme',
        '--multi',
        '--dir',
        '../website/docs/cli/',
      ],
      { stdio: 'inherit' },
    )
    spawn.sync(
      'git',
      [
        'add',
        'packages/apollo-cli/README.md',
        'packages/website/docs/cli/*.md',
      ],
      { stdio: 'inherit' },
    )
  }
}

main()
