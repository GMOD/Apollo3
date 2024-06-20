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

describe('apollo login: Config file does not exist', () => {
  const cmd = ['login', '--config-file', '_tmp.yaml']
  test
    .stderr()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .catch(ctx => {
      expect(ctx.message).to.contain('apollo config')
    })
    .it(cmd.join(' '))
})

describe('apollo login: Profile does not exist', () => {
  const cmd = [
    'login',
    '--config-file',
    'test_data/complete_config.yaml',
    '--profile',
    'notavailable',
  ]
  test
    .stderr()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .catch(ctx => {
      expect(ctx.message).to.contain('apollo config')
      expect(ctx.message).to.contain('Profile')
      expect(ctx.message).to.contain('notavailable')
    })
    .it(cmd.join(' '))
})

// TODO: Mock server
describe.skip('apollo login: Add token for guest', () => {
  before(() => {
    copyFile(`${TEST_DATA_DIR}/guest.yaml`, CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  const cmd = ['login']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.default.accessToken).not.empty
    })
})
