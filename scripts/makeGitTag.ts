import fs from 'node:fs'
import path from 'node:path'

import { sync } from 'cross-spawn'
import { inc } from 'semver'
import yargs from 'yargs/yargs'

function getCurrentVersion() {
  const packageJSONRaw = fs.readFileSync(
    path.join('packages', 'apollo-cli', 'package.json'),
    'utf8',
  )
  const packageJSON = JSON.parse(packageJSONRaw) as { version: string }
  return packageJSON.version
}

function exec(executable: string, args?: string[]) {
  const child = sync(executable, args, { stdio: 'inherit' })
  if (child.error) {
    throw child.error
  }
  if (child.status !== 0) {
    throw new Error(`Process failed with code ${child.status}`)
  }
}

const usage = `Prepare and push source code for new tag release. See code for details. Steps are:

* 'yarn version' to update non-private packages to <tag>

* 'git add' all (and only) the package.json files from previous step

* 'git commit'

* 'git tag' to tag and annotate the current commit

* 'git push' the commits and tag`

const argv = yargs(process.argv.slice(2))
  .usage(usage)
  .strict()
  .version('0.1.0')
  .example('$0 -t v1.2.3 -m "New relase"', '')
  .options({
    strategy: {
      alias: 's',
      choices: ['patch', 'minor', 'major'],
      default: 'patch',
    },
    message: {
      alias: 'm',
      describe: 'Commit message [Tag release <tag>]',
      type: 'string',
    },
    'root-dir': {
      alias: 'r',
      default: '.',
      describe: 'Root directory of Apollo source code',
    },
  })
  .parseSync()

const { message, strategy } = argv

process.chdir(argv['root-dir'])

const currentVersion = getCurrentVersion()
const newVersion = inc(currentVersion, strategy as 'patch' | 'minor' | 'major')
if (!newVersion) {
  throw new Error('Could not determine next version')
}

let m: string | undefined = message
if (m === undefined) {
  m = `Tag release v${newVersion}`
}

exec('yarn', [
  'workspaces',
  'foreach',
  '--all',
  '--no-private',
  'version',
  strategy,
])
exec('git', ['add', '--force', 'packages/**/package.json'])
exec('git', ['commit', '--message', m])
exec('git', ['tag', '--annotate', `v${newVersion}`, '--message', m])
exec('git', ['push', '--follow-tags'])
