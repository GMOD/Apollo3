import * as fs from 'node:fs'

import {DEFAULT_CONFIG_FILE as CONFIG_FILE } from '../src/config'

const CONFIG_BAK: string = 'test_data/original.config.yaml.bak'
export const VERBOSE = false

function renameFile(src: string, dest: string, verbose: boolean) {
  if(fs.existsSync(dest)) {
    console.log('DONE')
    throw Error(`Backup file ${dest} already exists`)
  }
  let msg: string = ''
  if(fs.existsSync(src)) {
    fs.renameSync(src, dest)
    msg = `mv ${src} ${dest}`
  } else {
    msg = `${src} does not exist`
  }
  if(verbose) {
    console.log(msg)
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
