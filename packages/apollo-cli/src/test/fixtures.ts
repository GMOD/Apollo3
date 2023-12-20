import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const TEST_DATA_DIR = path.resolve('test_data')
export const VERBOSE = false
export const CONFIG_FILE = path.join(
  os.homedir(),
  '/.config/apollo-cli/config.yaml',
)
const CONFIG_BAK = path.join(TEST_DATA_DIR, 'original.config.yaml.bak')

function renameFile(src: string, dest: string, verbose = true) {
  if (fs.existsSync(dest)) {
    throw new Error(`File ${dest} already exists`)
  }
  let msg = ''
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest)
    msg = `mv ${src} ${dest}`
  } else {
    msg = `${src} does not exist`
  }
  if (verbose) {
    console.log(msg)
  }
}

export function copyFile(src: string, dest: string, verbose: boolean) {
  fs.copyFileSync(src, dest)
  if (verbose) {
    const msg = `cp ${src} ${dest}`
    console.log(`${msg} # Copied: ${fs.existsSync(dest)}`)
  }
}

export async function mochaGlobalSetup() {
  // Temporarily remove config file, if any
  renameFile(CONFIG_FILE, CONFIG_BAK, VERBOSE)
}

export async function mochaGlobalTeardown() {
  // Put config file back
  renameFile(CONFIG_BAK, CONFIG_FILE, VERBOSE)
}
