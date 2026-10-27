import fs from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'yaml'

import {
  downloadFile,
  extractTarGz,
  fetchJSON,
  readFileFromTarGz,
} from './download.js'
import { runNode } from './run.js'

const SERVER_WORKSPACE = '@apollo-annotation/collaboration-server'
const MARKER_FILE = '.apollo-setup.json'

export function sourceTarballURL(version: string): string {
  return `https://github.com/GMOD/Apollo3/archive/refs/tags/v${version}.tar.gz`
}

export function releaseDir(installDir: string, version: string): string {
  return path.join(installDir, 'releases', `v${version}`)
}

export function serverPackageDir(dir: string): string {
  return path.join(dir, 'packages', 'apollo-collaboration-server')
}

const SERVER_PACKAGE_JSON = 'packages/apollo-collaboration-server/package.json'

/**
 * Read the collaboration server's package.json for a release, from the built
 * release if there is one, otherwise from the source tarball or GitHub
 */
export async function readServerPackageJSON(
  version: string,
  source: { builtDir?: string; sourceTarball?: string },
): Promise<unknown> {
  if (source.builtDir) {
    return JSON.parse(
      await fs.readFile(
        path.join(source.builtDir, SERVER_PACKAGE_JSON),
        'utf8',
      ),
    )
  }
  if (source.sourceTarball) {
    const text = await readFileFromTarGz(
      source.sourceTarball,
      SERVER_PACKAGE_JSON,
      1,
    )
    if (text === undefined) {
      throw new Error(`${source.sourceTarball} has no ${SERVER_PACKAGE_JSON}`)
    }
    return JSON.parse(text)
  }
  return fetchJSON(
    `https://raw.githubusercontent.com/GMOD/Apollo3/v${version}/${SERVER_PACKAGE_JSON}`,
  )
}

/** Whether a release's collaboration server can run an embedded MongoDB */
export function supportsEmbeddedMongoDB(serverPackageJSON: unknown): boolean {
  const { dependencies } = serverPackageJSON as {
    dependencies?: Record<string, string>
  }
  return Boolean(dependencies?.['mongodb-memory-server-core'])
}

/** Read `yarnPath` from a `.yarnrc.yml` */
export function parseYarnPath(yarnrc: string): string {
  const { yarnPath } = (parse(yarnrc) ?? {}) as { yarnPath?: unknown }
  if (typeof yarnPath !== 'string' || !yarnPath) {
    throw new Error('Could not find "yarnPath" in .yarnrc.yml')
  }
  return yarnPath
}

/** Whether a release directory holds a completed build of `version` */
export async function isReleaseBuilt(
  dir: string,
  version: string,
): Promise<boolean> {
  try {
    const marker = JSON.parse(
      await fs.readFile(path.join(dir, MARKER_FILE), 'utf8'),
    ) as { version?: string }
    return marker.version === version
  } catch {
    return false
  }
}

/**
 * Download, build and focus the collaboration server from a release's source
 * tarball, the same way the Dockerfile does. The build happens in a
 * `.partial` directory that's renamed when it succeeds, so a failed run never
 * leaves a release that looks complete. `sourceTarball` is a local file to use
 * instead of downloading from GitHub.
 */
export async function buildRelease(
  installDir: string,
  version: string,
  sourceTarball?: string,
): Promise<void> {
  const finalDir = releaseDir(installDir, version)
  const partialDir = `${finalDir}.partial`
  await fs.rm(partialDir, { recursive: true, force: true })
  await fs.mkdir(partialDir, { recursive: true })

  let tarball = sourceTarball
  if (!tarball) {
    tarball = `${partialDir}.tar.gz`
    console.debug(`Downloading Apollo ${version} source`)
    await downloadFile(sourceTarballURL(version), tarball)
  }
  await extractTarGz(tarball, partialDir, 1)
  if (!sourceTarball) {
    await fs.rm(tarball)
  }

  const yarnPath = parseYarnPath(
    await fs.readFile(path.join(partialDir, '.yarnrc.yml'), 'utf8'),
  )
  // Use the Yarn release bundled in the source, so the admin doesn't need
  // corepack (which Node 25 no longer ships) or a global Yarn
  const yarn = (label: string, ...args: string[]) =>
    runNode(label, [path.join(partialDir, yarnPath), ...args], {
      cwd: partialDir,
      env: {
        CYPRESS_INSTALL_BINARY: '0',
        // The constraints in yarn.config.cjs need dev dependencies that the
        // production focus removes, and only matter for development
        YARN_ENABLE_CONSTRAINTS_CHECKS: 'false',
      },
    })
  await yarn('install', 'install', '--immutable')
  await yarn('build', 'workspace', SERVER_WORKSPACE, 'build')
  await yarn('focus', 'workspaces', 'focus', '--production', SERVER_WORKSPACE)

  await fs.writeFile(
    path.join(partialDir, MARKER_FILE),
    JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2),
  )
  await fs.rm(finalDir, { recursive: true, force: true })
  await fs.rename(partialDir, finalDir)
}

/** Point the install directory's `current` link at a release */
export async function activateRelease(
  installDir: string,
  version: string,
): Promise<void> {
  const current = path.join(installDir, 'current')
  if (process.platform === 'win32') {
    // A junction needs no admin rights or Developer Mode, but must have an
    // absolute target and can't be replaced atomically. The server should be
    // stopped during an upgrade anyway.
    await fs.unlink(current).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    })
    await fs.symlink(releaseDir(installDir, version), current, 'junction')
    return
  }
  // Replace the link atomically by renaming a new one over it. The target is
  // relative so the install directory can be moved.
  const temporary = `${current}.${process.pid}.tmp`
  await fs.symlink(path.join('releases', `v${version}`), temporary)
  await fs.rename(temporary, current)
}
