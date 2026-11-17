/**
 * Pre-commit hook to format changed non-JS/TS files
 * JS/TS files ignored since ESLint provides formatting feedback for those
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')

const spawn = require('cross-spawn')
/* eslint-enable @typescript-eslint/no-require-imports */

const cliDocsDir = path.join(
  __dirname,
  '..',
  'packages/website/docs/03-multi-user/03-guides/04-cli',
)

/**
 * `oclif readme --multi` writes one page per topic, with a `# <topic>` title, a
 * list of links to each command, and a `## <command>` section per command. When
 * a topic has a single command with the same name (e.g. `apollo login`), the
 * title and section heading are identical, so Docusaurus gives the section the
 * ID `apollo-login-1` and the list's `#apollo-login` link is broken. In that
 * case the list only links to the section right below it, so remove it.
 */
function removeRedundantCommandLists() {
  for (const fileName of fs.readdirSync(cliDocsDir)) {
    if (!fileName.endsWith('.md')) {
      continue
    }
    const filePath = path.join(cliDocsDir, fileName)
    const contents = fs.readFileSync(filePath, 'utf8')
    const title = /^# (.+)$/m.exec(contents)?.[1]
    if (!title) {
      continue
    }
    const listItems = contents.match(/^- \[.*\]\(#.*\)$/gm) ?? []
    if (listItems.length !== 1 || !listItems[0].startsWith(`- [${title}](#`)) {
      continue
    }
    fs.writeFileSync(filePath, contents.replace(`${listItems[0]}\n\n`, ''))
  }
}

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
    spawn.sync(
      'yarn',
      [
        'workspace',
        '@apollo-annotation/cli',
        'oclif',
        'readme',
        '--multi',
        '--dir',
        '../website/docs/03-multi-user/03-guides/04-cli/',
      ],
      { stdio: 'inherit' },
    )
    removeRedundantCommandLists()
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
