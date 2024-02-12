import fs from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@oclif/test'
import YAML from 'yaml'

import {
  CONFIG_FILE,
  TEST_DATA_DIR,
  VERBOSE,
  copyFile,
} from '../test/fixtures.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

describe('apollo status: Check logged in', () => {
  before(() => {
    copyFile(`${TEST_DATA_DIR}/complete_config.yaml`, CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  let cmd = ['status', '--profile', 'default']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), (ctx) => {
      expect(ctx.stdout).contain('Logged in')})

  cmd = ['status', '--profile', 'noAccessToken']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), (ctx) => {
      expect(ctx.stdout).contain('Logged out')})
})

describe('apollo status: Config file does not exist', () => {
  const cmd = ['status', '--config-file', '_tmp.yaml']
  test
    .stderr()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .exit(1)
    .do((output) => expect(output.stderr).to.contain('apollo config'))
    .it(cmd.join(' '))
})

describe('apollo status: Profile does not exist', () => {
  const cmd = ['status', '--config-file', 'test_data/complete_config.yaml', '--profile', 'notavailable']
  test
    .stderr()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .exit(1)
    .do((output) => expect(output.stderr).to.contain('apollo config'))
    .do((output) => expect(output.stderr).to.contain('Profile'))
    .do((output) => expect(output.stderr).to.contain('notavailable'))
    .it(cmd.join(' '))
})