import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@oclif/test'

import {
  CONFIG_FILE,
  TEST_DATA_DIR,
  VERBOSE,
  copyFile,
} from '../../test/fixtures.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// TODO: Need valid token
describe.skip('apollo user get: Get users as YAML string', () => {
  before(() => {
    copyFile(`${TEST_DATA_DIR}/complete_config.yml`, CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  const cmd = ['user:get']
  test
    .stdout()
    .command(cmd, { root: path.dirname(path.dirname(__dirname)) })
    .it(cmd.join(' '), (output) => {
      const str: string = JSON.stringify(JSON.parse(output.stdout))
      expect(str).contain('username')
    })
})
