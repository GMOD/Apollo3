import fs from 'node:fs/promises'
import path from 'node:path'

import { confirm } from '@inquirer/prompts'
import { Command, Errors, Flags } from '@oclif/core'

import {
  LOGIN_METHODS,
  MONGODB_TYPES,
  NEW_USER_ROLES,
  USER_ROLES,
  gatherAnswers,
} from '../setup/answers.js'
import { urlExists } from '../setup/download.js'
import { maskEnv, mongoDBBinaryDir, renderEnv } from '../setup/env.js'
import { type AddedFile, addOntology, addPlugin } from '../setup/jbrowse.js'
import { downloadMongoDBBinary } from '../setup/mongodb.js'
import {
  activateRelease,
  buildRelease,
  isReleaseBuilt,
  readServerPackageJSON,
  releaseDir,
  sourceTarballURL,
  supportsEmbeddedMongoDB,
} from '../setup/server.js'
import { renderStartScript } from '../setup/startScript.js'
import {
  describeAnswers,
  describeJBrowseFiles,
  renderSummary,
} from '../setup/summary.js'

const MINIMUM_NODE_MAJOR = 20
// A full `yarn install` of the Apollo source, plus the build
const MINIMUM_FREE_BYTES = 4 * 1024 ** 3

// Extends Command, not BaseCommand, since BaseCommand needs an existing
// profile and there isn't one yet when setting up a server
export default class Setup extends Command {
  static summary = 'Install and configure an Apollo collaboration server'
  static description = `Asks a few questions, then downloads and builds the collaboration server, adds the Apollo plugin to an existing JBrowse Web directory, writes the server's .env file, and prints how to start the server.

JBrowse must already be installed (see "jbrowse create" from @jbrowse/cli) and have at least one config file. Setup adds files to the JBrowse directory but never overwrites a file or changes a config file.

Every question has a matching flag. With --yes, setup uses the defaults for every question not answered by a flag.

Run setup again with the same install directory to upgrade to a new --apollo-version, or to roll back to an older one.`

  static examples = [
    {
      description: 'Answer the questions interactively:',
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Install without questions, using an embedded MongoDB:',
      command:
        '<%= config.bin %> <%= command.id %> --yes --install-dir /opt/apollo --jbrowse-dir /var/www/jbrowse --mongodb embedded',
    },
  ]

  static flags = {
    'install-dir': Flags.string({
      char: 'd',
      description: 'Directory to install Apollo in',
    }),
    'apollo-version': Flags.string({
      description: 'Apollo version to install (default: this CLI version)',
    }),
    'jbrowse-dir': Flags.string({
      description: 'Existing JBrowse Web directory',
    }),
    'jbrowse-config-files': Flags.string({
      description:
        'Comma-separated JBrowse config files, relative to the JBrowse directory',
    }),
    url: Flags.string({ description: 'Public URL users will open Apollo at' }),
    port: Flags.integer({ description: 'Port for the server to listen on' }),
    name: Flags.string({ description: 'Server name' }),
    description: Flags.string({ description: 'Server description' }),
    mongodb: Flags.string({
      description: 'Use an existing MongoDB server, or an embedded one',
      options: [...MONGODB_TYPES],
    }),
    'mongodb-uri': Flags.string({
      description: 'URI of an existing MongoDB server',
    }),
    'mongodb-dir': Flags.string({
      description: 'Directory for the embedded MongoDB data',
    }),
    login: Flags.string({
      description: 'Login methods to enable',
      options: [...LOGIN_METHODS],
      multiple: true,
    }),
    'root-password': Flags.string({ description: 'Root user password' }),
    'guest-role': Flags.string({
      description: 'Role for the guest user',
      options: [...USER_ROLES],
    }),
    'google-client-id': Flags.string({ description: 'Google client ID' }),
    'google-client-secret': Flags.string({
      description: 'Google client secret',
    }),
    'microsoft-client-id': Flags.string({ description: 'Microsoft client ID' }),
    'microsoft-client-secret': Flags.string({
      description: 'Microsoft client secret',
    }),
    'initial-admin-email': Flags.string({
      description: 'Email of a user who becomes admin on first login',
    }),
    'default-new-user-role': Flags.string({
      description: 'Role for new users when they first log in',
      options: [...NEW_USER_ROLES],
    }),
    'upload-dir': Flags.string({ description: 'Directory for uploaded files' }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Use the defaults for questions not answered by a flag',
    }),
    'dry-run': Flags.boolean({
      description: 'Print what setup would do and the .env, then exit',
    }),
    force: Flags.boolean({
      description: 'Rebuild the release even if it was already built',
    }),
    // For testing unreleased versions
    'source-tarball': Flags.string({
      description: 'Local Apollo source .tar.gz to use instead of GitHub',
      hidden: true,
    }),
    'plugin-tarball': Flags.string({
      description: 'Local plugin npm package .tgz to use instead of npm',
      hidden: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Setup)
    const sourceTarball =
      flags['source-tarball'] && path.resolve(flags['source-tarball'])
    const pluginTarball =
      flags['plugin-tarball'] && path.resolve(flags['plugin-tarball'])

    const { answers, previousEnv, isUpgrade, rootPasswordGenerated } =
      await gatherAnswers(flags, {
        defaultVersion: this.config.version,
        checkMinimumVersion: !sourceTarball,
        log: (message) => {
          this.log(message)
        },
      })
    const { installDir, apolloVersion, jbrowseDir } = answers
    const envText = renderEnv(answers, previousEnv)
    const startScript = renderStartScript(process.platform, installDir)

    this.log(`\n${isUpgrade ? 'Updating' : 'Installing'} Apollo with:`)
    this.log(describeAnswers(answers))
    this.log(`\nFiles to add to ${jbrowseDir}, if missing:`)
    this.log(describeJBrowseFiles(answers))

    if (flags['dry-run']) {
      this.log(`\n.env (secrets masked):\n\n${maskEnv(envText)}`)
      this.log(`${startScript.fileName}:\n\n${startScript.content}`)
      this.log('Dry run, so nothing was written.')
      return
    }
    if (!flags.yes && !(await confirm({ message: 'Continue?' }))) {
      this.log('Setup cancelled, nothing was written.')
      return
    }

    const release = releaseDir(installDir, apolloVersion)
    const alreadyBuilt =
      !flags.force && (await isReleaseBuilt(release, apolloVersion))
    await this.preflight(installDir, jbrowseDir, apolloVersion, {
      sourceTarball,
      needsSource: !alreadyBuilt,
    })
    if (answers.mongodb.type === 'embedded') {
      const serverPackageJSON = await readServerPackageJSON(
        apolloVersion,
        alreadyBuilt ? { builtDir: release } : { sourceTarball },
      )
      if (!supportsEmbeddedMongoDB(serverPackageJSON)) {
        this.error(
          `Apollo ${apolloVersion} doesn't support the embedded MongoDB. ` +
            'Install a newer version, or use an existing MongoDB server.',
        )
      }
    }

    // Add the JBrowse files first, since they can fail on an existing file
    // and are much quicker than the build
    this.log('\nAdding files to the JBrowse directory')
    const addedFiles: AddedFile[] = [
      await addPlugin(jbrowseDir, apolloVersion, pluginTarball),
      await addOntology(jbrowseDir),
    ]

    if (alreadyBuilt) {
      this.log(`\nApollo ${apolloVersion} is already built, skipping the build`)
    } else {
      this.log(`\nBuilding Apollo ${apolloVersion}. This can take a while.`)
      await buildRelease(installDir, apolloVersion, sourceTarball)
    }

    if (answers.mongodb.type === 'embedded') {
      this.log('\nDownloading MongoDB for the embedded MongoDB')
      await fs.mkdir(answers.mongodb.dataDir, { recursive: true })
      await downloadMongoDBBinary(release, mongoDBBinaryDir(installDir))
    }
    await fs.mkdir(answers.uploadDir, { recursive: true })

    const envFile = path.join(installDir, '.env')
    await fs.writeFile(envFile, envText, { mode: 0o600 })
    // The mode only applies when the file is created
    await fs.chmod(envFile, 0o600)

    await activateRelease(installDir, apolloVersion)
    await fs.writeFile(
      path.join(installDir, startScript.fileName),
      startScript.content,
      { mode: 0o755 },
    )

    this.log(
      `\n${renderSummary({
        answers,
        startScriptName: startScript.fileName,
        addedFiles,
        rootPasswordGenerated,
        platform: process.platform,
      })}`,
    )
  }

  // Print setup's errors as plain messages rather than stack traces
  protected async catch(error: Error & { exitCode?: number }): Promise<void> {
    if (error instanceof Errors.CLIError) {
      await super.catch(error)
      return
    }
    // Thrown by @inquirer/prompts on Ctrl-C
    if (error.name === 'ExitPromptError') {
      this.error('Setup cancelled', { exit: 130 })
    }
    this.error(error.message)
  }

  private async preflight(
    installDir: string,
    jbrowseDir: string,
    version: string,
    {
      sourceTarball,
      needsSource,
    }: { sourceTarball: string | undefined; needsSource: boolean },
  ): Promise<void> {
    const nodeMajor = Number(process.versions.node.split('.')[0])
    if (nodeMajor < MINIMUM_NODE_MAJOR) {
      this.error(
        `Apollo needs Node.js ${MINIMUM_NODE_MAJOR} or later, but this is ${process.versions.node}`,
      )
    }
    await fs.mkdir(path.join(installDir, 'releases'), { recursive: true })
    for (const dir of [installDir, jbrowseDir]) {
      try {
        await fs.access(dir, fs.constants.W_OK)
      } catch {
        this.error(`Can't write to "${dir}"`)
      }
    }
    if (!needsSource) {
      return
    }
    const { bavail, bsize } = await fs.statfs(installDir)
    if (bavail * bsize < MINIMUM_FREE_BYTES) {
      this.error(
        `Setup needs about ${MINIMUM_FREE_BYTES / 1024 ** 3} GB of free disk space in "${installDir}"`,
      )
    }
    if (sourceTarball) {
      await fs.access(sourceTarball)
    } else if (!(await urlExists(sourceTarballURL(version)))) {
      this.error(`Couldn't find Apollo release v${version} on GitHub`)
    }
  }
}
