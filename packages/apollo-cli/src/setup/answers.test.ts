/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import {
  MINIMUM_APOLLO_VERSION,
  compareVersions,
  inspectInstallDir,
  resolveDir,
  validateEmail,
  validateMongoDBURI,
  validatePort,
  validateVersion,
} from './answers.js'

describe('compareVersions', () => {
  it('compares major, minor and patch numerically', () => {
    assert.ok(compareVersions('1.10.0', '1.9.0') > 0)
    assert.ok(compareVersions('1.2.3', '1.3.0') < 0)
    assert.strictEqual(compareVersions('2.0.0', '2.0.0'), 0)
    assert.strictEqual(compareVersions('2.0.0-beta.1', '2.0.0'), 0)
  })
})

describe('resolveDir', () => {
  it('expands a leading ~ to the home directory', () => {
    assert.strictEqual(resolveDir('~'), os.homedir())
    assert.strictEqual(
      resolveDir('~/apollo'),
      path.join(os.homedir(), 'apollo'),
    )
  })

  it('resolves other paths against the current directory', () => {
    assert.strictEqual(resolveDir('apollo'), path.resolve('apollo'))
    assert.strictEqual(resolveDir('~apollo'), path.resolve('~apollo'))
    assert.strictEqual(resolveDir('/opt/apollo'), path.resolve('/opt/apollo'))
  })
})

describe('validators', () => {
  it('validateVersion', () => {
    assert.strictEqual(validateVersion(MINIMUM_APOLLO_VERSION), undefined)
    assert.ok(validateVersion('1.0.0'))
    assert.strictEqual(validateVersion('1.0.0', false), undefined)
    assert.ok(validateVersion('v1.3.0'))
    assert.ok(validateVersion('latest'))
  })
  it('validatePort', () => {
    assert.strictEqual(validatePort('3999'), undefined)
    assert.ok(validatePort('0'))
    assert.ok(validatePort('70000'))
    assert.ok(validatePort('39.5'))
  })
  it('validateMongoDBURI', () => {
    assert.strictEqual(validateMongoDBURI('mongodb://localhost/db'), undefined)
    assert.strictEqual(validateMongoDBURI('mongodb+srv://a.b/db'), undefined)
    assert.ok(validateMongoDBURI('localhost:27017'))
  })
  it('validateEmail', () => {
    assert.strictEqual(validateEmail(''), undefined)
    assert.strictEqual(validateEmail('admin@example.org'), undefined)
    assert.ok(validateEmail('not an email'))
  })
})

describe('inspectInstallDir', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'apollo-setup-test-'))
  after(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('accepts a missing or empty directory as new', async () => {
    assert.deepStrictEqual(
      await inspectInstallDir(path.join(root, 'missing')),
      {
        type: 'new',
      },
    )
    const empty = path.join(root, 'empty')
    await fs.mkdir(empty)
    assert.deepStrictEqual(await inspectInstallDir(empty), { type: 'new' })
  })

  it('reads the .env of an earlier install', async () => {
    const existing = path.join(root, 'existing')
    await fs.mkdir(path.join(existing, 'releases'), { recursive: true })
    await fs.writeFile(
      path.join(existing, '.env'),
      'NAME=Old\nJWT_SECRET=abc\n',
    )
    const state = await inspectInstallDir(existing)
    assert.strictEqual(state.type, 'existing')
    assert.strictEqual(state.env.get('JWT_SECRET'), 'abc')
  })

  it('resumes a first install that failed before writing .env', async () => {
    const failed = path.join(root, 'failed')
    await fs.mkdir(path.join(failed, 'releases', 'v1.3.0.partial'), {
      recursive: true,
    })
    assert.deepStrictEqual(await inspectInstallDir(failed), { type: 'new' })
  })

  it('rejects any other non-empty directory', async () => {
    const other = path.join(root, 'other')
    await fs.mkdir(other)
    await fs.writeFile(path.join(other, 'notes.txt'), 'hi')
    await assert.rejects(inspectInstallDir(other), /isn't empty/)
  })
})
