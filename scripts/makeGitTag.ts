import fs from 'node:fs'
import path from 'node:path'

import { spawn } from 'cross-spawn'
import yargs from 'yargs/yargs'

class Shell {
  stdout: string
  stderr: string
  returncode: number
  cmd: string
  constructor(cmd: string, args: string[], verbose = true) {
    this.cmd = `${cmd} ${args.join(' ')}`
    if (verbose) {
      process.stderr.write(`${this.cmd}\n`)
    }
    const child = spawn.sync(cmd, args)
    this.stdout =
      child.stdout === null ? '' : String.fromCodePoint(...child.stdout)
    this.stderr =
      child.stderr === null ? '' : String.fromCodePoint(...child.stderr)
    this.returncode = child.status

    if (this.returncode != 0) {
      throw new Error(
        `\n${this.cmd}\nSTDOUT:\n${this.stdout}\nSTDERR:\n${this.stderr}\nEXIT CODE: ${this.returncode}`,
      )
    }
  }
}

function getPackages(): string[] {
  const p = new Shell('yarn', ['workspaces', 'list', '--json', '--no-private'])
  const lines: string[] = p.stdout.trim().split('\n')
  const packages: string[] = []
  for (const line of lines) {
    const j = JSON.parse(line)
    const pack: string = path.join(j.location, 'package.json')
    if (!fs.existsSync(pack)) {
      throw new Error(`Error: Expected file '${pack}' does not exist\n`)
    }
    packages.push(pack)
  }
  return packages
}

function checkTag(tag: string, testRegex = /v\d+.\d+.\d+.*/) {
  if (!testRegex.test(tag)) {
    throw new Error(`Invalid tag: '${tag}' does not match regex ${testRegex}\n`)
  }
}

function updatePackageVersion(newVersion: string, packagesToUpdate: string[]) {
  for (const pck of packagesToUpdate) {
    new Shell('yarn', [
      '--cwd',
      pck.replace('package.json', ''),
      'version',
      newVersion,
    ])
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
  .version('0.1.0')
  .example('$0 -t v1.2.3 -m "New relase"')
  .options({
    tag: {
      demandOption: true,
      alias: 't',
      describe: 'Version for this tag, e.g. v1.2.3',
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
    'update-only': { describe: 'Only update package versions and exit' },
  })
  .parseSync()

const tag = argv.tag as string

process.chdir(argv['root-dir'])

let m: string = argv.message as string
if (m === undefined) {
  m = `Tag release ${tag}`
}

checkTag(tag)
const packages = getPackages()
updatePackageVersion(tag, packages)
if (argv['update-only']) {
  process.exit(0)
}
new Shell('git', ['add', '--force', ...packages])
new Shell('git', ['commit', '--message', m, '--', ...packages])
new Shell('git', ['tag', '--annotate', tag, '--message', m])
new Shell('git', ['push', '--follow-tags'])
