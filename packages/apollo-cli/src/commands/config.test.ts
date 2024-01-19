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

  let cmd = ['config', 'rootCredentials.password']
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

  cmd = ['config', 'someInvalidKey']
  test
    .stderr()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .exit(1)
    .do((output) => expect(output.stderr).to.contain('someInvalidKey'))
    .it(cmd.join(' '))

  cmd = ['config', '-p', 'profile1', 'address']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), (ctx) => {
      expect(ctx.stdout.trim()).to.equal('http://localhost:1999')
    })

  cmd = ['config', '-p', 'profile1', 'rootCredentials.username']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), (ctx) => {
      expect(ctx.stdout.trim()).to.equal('')
    })

  cmd = ['config', '-p', 'nonExistantProfile', 'address']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), (ctx) => {
      expect(ctx.stdout.trim()).to.equal('')
    })
})

describe('apollo config: Missing config file', () => {
  let cmd = ['config', 'rootCredentials.password']
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
      expect(cfg.default.address).to.equal('http://localhost:4321')
      expect(cfg.default.rootCredentials.username).to.equal('root')
    })

  cmd = ['config', 'rootCredentials.username', 'root2']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.default.rootCredentials.username).to.equal('root2')
    })

  cmd = ['config', 'accessType', 'microsoft']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.default.accessType).to.equal('microsoft')
    })
})

describe('Do not set invalid address', () => {
  before(() => {
    copyFile(`${TEST_DATA_DIR}/complete_config.yaml`, CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  const cmd = ['config', 'address', 'http://localhost:3999xxx']
  test
    .stderr()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .exit(1)
    .do((output) =>
      expect(output.stderr).to.contain('http://localhost:3999xxx'),
    )
    .it(cmd.join(' '))
})

describe('apollo config: Write config file from scratch', () => {
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  let cmd = ['config', 'rootCredentials.username', 'somename']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.default.rootCredentials.username).to.equal('somename')
    })

  cmd = ['config', '-p', 'myProfile', 'rootCredentials.password', 'somepwd']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), () => {
      const cfg = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      expect(cfg.myProfile.rootCredentials.password).to.equal('somepwd')
    })
})
