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

describe('apollo config: Query config file', () => {
  before(() => {
    copyFile(`${TEST_DATA_DIR}/complete_config.yaml`, CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  let cmd = ['config', 'password']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), (ctx) => {
      expect(ctx.stdout.trim()).to.equal('1234')
    })

  cmd = ['config', 'address']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), (ctx) => {
      expect(ctx.stdout.trim()).to.equal('http://localhost:3999')
    })

  cmd = ['config', 'stuff']
  test
    .stderr()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .exit(1)
    .do((output) => expect(output.stderr).to.contain('stuff'))
    .it(cmd.join(' '))
})

describe('apollo config: Missing config file', () => {
  let cmd = ['config', 'password']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), (ctx) => {
      expect(ctx.stdout.trim()).to.equal('')
    })

  cmd = ['config', 'address']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), (ctx) => {
      expect(ctx.stdout.trim()).to.equal('')
    })
})

describe('apollo config: Read & edit config file', () => {
  before(() => {
    copyFile(`${TEST_DATA_DIR}/complete_config.yaml`, CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  let cmd = ['config', 'address', 'http://localhost:4321']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.login.address).to.equal('http://localhost:4321')
      expect(cfg.login.userCredentials.username).to.equal('root')
    })

  cmd = ['config', 'username', 'root2']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.login.userCredentials.username).to.equal('root2')
    })

  cmd = ['config', 'google', 'abcd']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.login.accessToken.google).to.equal('abcd')
    })
})

describe('apollo config: Write config file from scratch', () => {
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  let cmd = ['config', 'address', 'http://localhost:4321']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.login.address).to.equal('http://localhost:4321')
    })

  cmd = ['config', 'username', 'me']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.login.userCredentials.username).to.equal('me')
      expect(cfg.login.address).to.equal('http://localhost:4321')
    })

  cmd = ['config', 'google', 'abcd']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.login.accessToken.google).to.equal('abcd')
    })
})
