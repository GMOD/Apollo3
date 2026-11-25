import fs from 'node:fs'
import path from 'node:path'

import { findReleasePost } from './releasePosts.js'

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

// Set the release version and date in CITATION.cff, failing if the file no
// longer has the expected fields so the release isn't tagged with stale values
function updateCitationFile(version: string) {
  const citationPath = 'CITATION.cff'
  const releaseDate = new Date().toISOString().slice(0, 10)
  let citation = fs.readFileSync(citationPath, 'utf8')
  for (const [field, value] of [
    ['version', version],
    ['date-released', releaseDate],
  ]) {
    const fieldPattern = new RegExp(`^${field}: .*$`, 'm')
    if (!fieldPattern.test(citation)) {
      throw new Error(`Could not find "${field}" in ${citationPath}`)
    }
    citation = citation.replace(fieldPattern, `${field}: "${value}"`)
  }
  fs.writeFileSync(citationPath, citation)
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

* Check that the release's blog post exists (see 'yarn release-notes new')

* 'yarn version' to update non-private packages and the collaboration server to <tag>

* 'git add' all (and only) the package.json files from previous step

* Update the version in the docker-compose docs and the version and release
  date in CITATION.cff, and 'git add' them

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
    'skip-notes': {
      describe:
        "Release without a blog post (the GitHub release uses GitHub's generated notes)",
      type: 'boolean',
      default: false,
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

const m = message ?? `Tag release v${newVersion}`

const post = findReleasePost(newVersion)
if (!argv['skip-notes']) {
  if (!post) {
    throw new Error(
      `No blog post found for v${newVersion}. Run "yarn release-notes new ${newVersion}" first and write the notes, or pass --skip-notes.`,
    )
  }
  if (fs.readFileSync(post.file, 'utf8').includes('TODO:')) {
    throw new Error(`${post.file} still has TODO notes in it`)
  }
}

exec('yarn', [
  'workspaces',
  'foreach',
  '--all',
  '--no-private',
  'version',
  strategy,
])
// The server is private so the step above skips it, but it reports its version
// to the JBrowse plugin, which expects the two to match
exec('yarn', [
  'workspace',
  '@apollo-annotation/collaboration-server',
  'version',
  strategy,
])
exec('git', ['add', '--force', 'packages/**/package.json'])
exec('sed', [
  '--in-place',
  '--regexp-extended',
  String.raw`s/APOLLO_VERSION=[0-9]+\.[0-9]+\.[0-9]+/APOLLO_VERSION=${newVersion}/`,
  'packages/website/docs/03-multi-user/02-installation/02-examples/01-docker-compose.md',
])
exec('git', [
  'add',
  'packages/website/docs/03-multi-user/02-installation/02-examples/01-docker-compose.md',
])
updateCitationFile(newVersion)
exec('git', ['add', 'CITATION.cff'])
if (post) {
  // A post with images is a folder, so add the whole folder
  const isFolder = path.basename(post.file).startsWith('index.')
  exec('git', ['add', isFolder ? post.dir : post.file])
}
exec('git', ['commit', '--message', m])
exec('git', ['tag', '--annotate', `v${newVersion}`, '--message', m])
exec('git', ['push', '--follow-tags'])
