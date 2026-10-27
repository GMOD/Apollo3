import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { downloadFile, extractTarGz, fetchJSON } from './download.js'
import { pluginFileName } from './env.js'

const PLUGIN_PACKAGE = '@apollo-annotation/jbrowse-plugin-apollo'
const PLUGIN_BUNDLE = 'package/dist/jbrowse-plugin-apollo.umd.production.min.js'
const ONTOLOGY_URL =
  'https://github.com/The-Sequence-Ontology/SO-Ontologies/raw/refs/heads/master/Ontology_Files/so.json'
// The server's default FEATURE_TYPE_ONTOLOGY_LOCATION
const ONTOLOGY_FILE = 'sequence_ontology.json'

const JBROWSE_CLI_DOCS = 'https://jbrowse.org/jb2/docs/cli/'

export type AddedFileStatus = 'added' | 'unchanged' | 'kept'

export interface AddedFile {
  fileName: string
  status: AddedFileStatus
}

/**
 * Check that a directory holds a JBrowse Web install. Returns an error
 * message, or undefined if it's valid.
 */
export async function validateJBrowseDir(
  dir: string,
): Promise<string | undefined> {
  const missing: string[] = []
  for (const file of ['index.html', 'version.txt']) {
    try {
      await fs.access(path.join(dir, file))
    } catch {
      missing.push(file)
    }
  }
  if (missing.length === 0) {
    return
  }
  return (
    `"${dir}" doesn't look like a JBrowse Web directory (missing ${missing.join(' and ')}). ` +
    'Install JBrowse first with `jbrowse create <dir>` from @jbrowse/cli, and ' +
    `add an assembly with \`jbrowse add-assembly\`. See ${JBROWSE_CLI_DOCS}`
  )
}

export async function readJBrowseVersion(dir: string): Promise<string> {
  const version = await fs.readFile(path.join(dir, 'version.txt'), 'utf8')
  return version.trim()
}

/**
 * Check that each config file exists in the JBrowse directory and is valid
 * JSON. Returns an error message, or undefined if they're all valid.
 */
export async function validateConfigFiles(
  jbrowseDir: string,
  configFiles: string[],
): Promise<string | undefined> {
  if (configFiles.length === 0) {
    return (
      'Enter at least one JBrowse config file. If there are none yet, create ' +
      'one first, e.g. with `jbrowse add-assembly`'
    )
  }
  for (const configFile of configFiles) {
    if (
      path.isAbsolute(configFile) ||
      configFile.split(/[/\\]/).includes('..')
    ) {
      return `"${configFile}" must be a path inside the JBrowse directory`
    }
    let text: string
    try {
      text = await fs.readFile(path.join(jbrowseDir, configFile), 'utf8')
    } catch {
      return `Config file "${configFile}" doesn't exist in "${jbrowseDir}"`
    }
    try {
      JSON.parse(text)
    } catch {
      return `Config file "${configFile}" isn't valid JSON`
    }
  }
  return
}

export function parseConfigFileList(list: string): string[] {
  return list
    .split(',')
    .map((file) => file.trim())
    .filter(Boolean)
}

/**
 * Write a file that must not already exist. If it does exist with the same
 * contents, leave it; if the contents differ, fail rather than overwrite it.
 */
export async function addFile(
  file: string,
  contents: Buffer,
): Promise<'added' | 'unchanged'> {
  try {
    await fs.writeFile(file, contents, { flag: 'wx' })
    return 'added'
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
  const existing = await fs.readFile(file)
  if (existing.equals(contents)) {
    return 'unchanged'
  }
  throw new Error(
    `"${file}" already exists with different contents. Setup never overwrites ` +
      'files in the JBrowse directory, so move or delete it and run setup again.',
  )
}

/** Read the plugin bundle out of an npm package tarball */
async function readPluginBundle(packageTarball: string): Promise<Buffer> {
  const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apollo-plugin-'))
  try {
    await extractTarGz(packageTarball, extractDir, 0, [PLUGIN_BUNDLE])
    return await fs.readFile(path.join(extractDir, PLUGIN_BUNDLE))
  } finally {
    await fs.rm(extractDir, { recursive: true, force: true })
  }
}

/**
 * Add the Apollo plugin bundle to the JBrowse directory under a versioned
 * name, so that upgrades never collide with an older plugin. `pluginTarball`
 * is a local npm package tarball to use instead of downloading from npm.
 */
export async function addPlugin(
  jbrowseDir: string,
  version: string,
  pluginTarball?: string,
): Promise<AddedFile> {
  let tarball = pluginTarball
  let temporaryDir: string | undefined
  if (!tarball) {
    const metadata = (await fetchJSON(
      `https://registry.npmjs.org/${PLUGIN_PACKAGE}/${version}`,
    )) as { dist?: { tarball?: string } }
    const tarballURL = metadata.dist?.tarball
    if (!tarballURL) {
      throw new Error(`No npm tarball found for ${PLUGIN_PACKAGE}@${version}`)
    }
    temporaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apollo-plugin-'))
    tarball = path.join(temporaryDir, 'plugin.tgz')
    console.debug(`Downloading ${PLUGIN_PACKAGE}@${version}`)
    await downloadFile(tarballURL, tarball)
  }
  try {
    const bundle = await readPluginBundle(tarball)
    const fileName = pluginFileName(version)
    const status = await addFile(path.join(jbrowseDir, fileName), bundle)
    return { fileName, status }
  } finally {
    if (temporaryDir) {
      await fs.rm(temporaryDir, { recursive: true, force: true })
    }
  }
}

/**
 * Add the Sequence Ontology to the JBrowse directory, unless the admin
 * already has an ontology file there
 */
export async function addOntology(jbrowseDir: string): Promise<AddedFile> {
  const file = path.join(jbrowseDir, ONTOLOGY_FILE)
  try {
    await fs.access(file)
    return { fileName: ONTOLOGY_FILE, status: 'kept' }
  } catch {
    // Doesn't exist yet, so download it
  }
  const temporaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apollo-so-'))
  try {
    const downloaded = path.join(temporaryDir, ONTOLOGY_FILE)
    console.debug('Downloading the Sequence Ontology')
    await downloadFile(ONTOLOGY_URL, downloaded)
    const status = await addFile(file, await fs.readFile(downloaded))
    return { fileName: ONTOLOGY_FILE, status }
  } finally {
    await fs.rm(temporaryDir, { recursive: true, force: true })
  }
}
