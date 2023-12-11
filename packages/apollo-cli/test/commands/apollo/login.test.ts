import { expect, test } from '@oclif/test'
import * as fs from 'node:fs'
import { DEFAULT_CONFIG_FILE as CONFIG_FILE } from '../../../src/config'
import { VERBOSE } from '../../fixtures'

function copyFile(src: string, dest: string, verbose: boolean) {
  let msg: string = `cp ${src} ${dest}`
  fs.copyFileSync(src, dest)
  if(verbose) {
    console.log(msg + `# Copied: ${fs.existsSync(dest)}`)
  }
}

describe('TODO: Interactive login', () => {
  // Need to find out: 1) How to simulate pressing anykey 2) Login with google if not already logged in
  // test
  // .stdout()
  // .command(['apollo:login'])
  // .it('Login interactively', ctx => {
  //   expect(ctx.stdout).to.contain('Login complete')
  // })
})

describe('Login without config file', () => {

  test
  .stdout()
  .command(['apollo:login', '-p', '1234', '-u', 'root', '-a', 'http://localhost:3999'])
  .it('Login with valid username, password and address', ctx => {
    expect(ctx.stdout).to.contain('Login complete')
  })

  test
  .stderr()
  .command(['apollo:login', '-p', '1234', '-u', 'foo'])
  .exit(2)
  .it('Fail with invalid username', ctx => {
    expect(ctx.stderr).to.contain('Failed')
  })

  test
  .stderr()
  .command(['apollo:login', '-p', '1234', '-u', 'root', '-a', 'http://foo:3999'])
  .exit(2)
  .it('Fail with invalid address', ctx => {
    expect(ctx.stderr).to.contain('Failed')
  })

  test
  .stderr()
  .command(['apollo:login', '-r'])
  .exit(2)
  .it('Fail login as root and suggest "apollo config"', ctx => {
    expect(ctx.stderr).to.contain('Failed')
    expect(ctx.stderr).to.contain('apollo config')
  })
})

describe('Login with complete config file', () => {
  
  before(() => {
    copyFile('test_data/complete_config.yaml', CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  test
  .stdout()
  .command(['apollo:login', '-r'])
  .it('Login as root', ctx => {
    expect(ctx.stdout).to.contain('Login complete')
  })

  test
  .stdout()
  .command(['apollo:login']) // Should this go for browser login instead?
  .it('Login without -r/--root flag', ctx => {
    expect(ctx.stdout).to.contain('Login complete')
  })

  test
  .stderr()
  .command(['apollo:login', '-r', '-u', 'foo'])
  .exit(2)
  .it('Override config file settings', ctx => {
    expect(ctx.stderr).to.contain('Failed')
  })

})

describe('Login with incomplete config file', () => {
  
  before(() => {
    copyFile('test_data/incomplete_config.yaml', CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  test
  .stdout()
  .command(['apollo:login', '-p', '1234'])
  .it('Override config file settings', ctx => {
    expect(ctx.stdout).to.contain('Login complete')
  })

  test
  .stderr()
  .command(['apollo:login', '-r'])
  .exit(2)
  .it('Fail with -r and incomplete credentials', ctx => {
    expect(ctx.stderr).to.contain('Failed')
    expect(ctx.stderr).to.contain('apollo config')
  })
}) 

describe('Login with broken config file', () => {

  before(() => {
    copyFile('test_data/broken_config.yaml', CONFIG_FILE, VERBOSE)
  })

  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  test
  .stderr()
  .command(['apollo:login', '-r'])
  .exit(2)
  .it('Fail with -r and incomplete credentials', ctx => {
    expect(ctx.stderr).to.contain('malformed')
  })

}) 