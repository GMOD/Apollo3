/**
 * Pre-commit hook to format changed non-JS/TS files
 * JS/TS files ignored since ESLint provides formatting feedback for those
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const spawn = require('cross-spawn')
/* eslint-enable @typescript-eslint/no-require-imports */

function main() {
  // Get names of files that were changed
  const changedFiles = spawn
    .sync('git', ['diff', '--cached', '--name-status'])
    .stdout.toString()
    .trim()
    .split(/[\n\r]+/)
    // Ignore deleted files
    .map((line) => (line.startsWith('D\t') ? undefined : line.split('\t')[1]))
    .filter((fileName) => fileName !== undefined)

  if (
    changedFiles.some(
      (fileName) =>
        fileName.includes('apollo-cli') && !fileName.includes('test'),
    )
  ) {
    spawn.sync('yarn', ['workspace', '@apollo-annotation/cli', 'build'], {
      stdio: 'inherit',
    })
    const docs = spawn.sync(
      'yarn',
      ['workspace', '@apollo-annotation/cli', 'docs:website'],
      { stdio: 'inherit' },
    )
    if (docs.status !== 0) {
      throw new Error('Could not generate the CLI website documentation')
    }
    spawn.sync(
      'yarn',
      ['workspace', '@apollo-annotation/cli', 'oclif', 'readme'],
      { stdio: 'inherit' },
    )
    spawn.sync(
      'git',
      [
        'add',
        'packages/apollo-cli/README.md',
        'packages/website/docs/03-multi-user/03-guides/04-cli/*.md',
      ],
      { stdio: 'inherit' },
    )
  }
}

main()
