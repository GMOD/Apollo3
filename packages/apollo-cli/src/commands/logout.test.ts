/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

describe('apollo logout: Set token to empty string', () => {
  before(() => {
    copyFile(`${TEST_DATA_DIR}/complete_config.yaml`, CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  let cmd = ['logout', '--profile', 'default']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.default.accessToken).to.equal('')
    })

  cmd = ['logout', '--profile', 'profile1']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.profile1.accessToken).to.equal('')
    })

  cmd = ['logout', '--profile', 'noAccessToken']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.profile1.accessToken).to.equal('')
    })
})

describe('apollo logout: Config file does not exist', () => {
  const cmd = ['logout', '--config-file', '_tmp.yaml']
  test
    .stderr()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .catch((error) => {
      expect(error.message).to.contain('apollo config')
    })
    .it(cmd.join(' '))
})

describe('apollo logout: Profile does not exist', () => {
  const cmd = [
    'logout',
    '--config-file',
    'test_data/complete_config.yaml',
    '--profile',
    'notavailable',
  ]
  test
    .stderr()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .catch((error) => {
      expect(error.message).to.contain('apollo config')
      expect(error.message).to.contain('Profile')
      expect(error.message).to.contain('notavailable')
    })
    .it(cmd.join(' '))
})
