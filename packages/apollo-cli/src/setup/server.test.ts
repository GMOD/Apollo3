/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import * as tar from 'tar'

import {
  activateRelease,
  isReleaseBuilt,
  parseYarnPath,
  readServerPackageJSON,
  releaseDir,
  supportsEmbeddedMongoDB,
} from './server.js'

describe('parseYarnPath', () => {
  it('reads yarnPath', () => {
    assert.strictEqual(
      parseYarnPath(
        'enableScripts: true\nyarnPath: .yarn/releases/yarn-4.18.0.cjs\n',
      ),
      '.yarn/releases/yarn-4.18.0.cjs',
    )
  })
  it('fails without yarnPath', () => {
    assert.throws(() => parseYarnPath('enableScripts: true\n'), /yarnPath/)
    assert.throws(() => parseYarnPath(''), /yarnPath/)
  })
})

describe('embedded MongoDB support', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'apollo-setup-pkg-'))
  after(async () => {
    await fs.rm(tmp, { recursive: true, force: true })
  })

  it('checks the server dependencies', () => {
    assert.ok(
      supportsEmbeddedMongoDB({
        dependencies: { 'mongodb-memory-server-core': '^11.0.0' },
      }),
    )
    assert.ok(!supportsEmbeddedMongoDB({ dependencies: { mongoose: '^8' } }))
    assert.ok(!supportsEmbeddedMongoDB({}))
  })

  it('reads the server package.json from a built release or a tarball', async () => {
    const packageJSON = { name: 'server', dependencies: { a: '1' } }
    const serverDir = path.join(
      tmp,
      'Apollo3-1.3.0',
      'packages',
      'apollo-collaboration-server',
    )
    await fs.mkdir(serverDir, { recursive: true })
    await fs.writeFile(
      path.join(serverDir, 'package.json'),
      JSON.stringify(packageJSON),
    )
    assert.deepStrictEqual(
      await readServerPackageJSON('1.3.0', {
        builtDir: path.join(tmp, 'Apollo3-1.3.0'),
      }),
      packageJSON,
    )
    const tarball = path.join(tmp, 'source.tar.gz')
    await tar.c({ file: tarball, gzip: true, cwd: tmp }, ['Apollo3-1.3.0'])
    assert.deepStrictEqual(
      await readServerPackageJSON('1.3.0', { sourceTarball: tarball }),
      packageJSON,
    )
  })
})

describe('releases', async () => {
  const installDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'apollo-release-test-'),
  )
  after(async () => {
    await fs.rm(installDir, { recursive: true, force: true })
  })

  it('checks the build marker', async () => {
    const dir = releaseDir(installDir, '1.3.0')
    await fs.mkdir(dir, { recursive: true })
    assert.strictEqual(await isReleaseBuilt(dir, '1.3.0'), false)
    await fs.writeFile(
      path.join(dir, '.apollo-setup.json'),
      JSON.stringify({ version: '1.3.0' }),
    )
    assert.strictEqual(await isReleaseBuilt(dir, '1.3.0'), true)
    assert.strictEqual(await isReleaseBuilt(dir, '1.4.0'), false)
  })

  it('switches the current link between releases', async () => {
    for (const version of ['1.3.0', '1.4.0']) {
      const dir = releaseDir(installDir, version)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, 'which'), version)
    }
    const current = path.join(installDir, 'current')
    await activateRelease(installDir, '1.3.0')
    assert.strictEqual(
      await fs.readFile(path.join(current, 'which'), 'utf8'),
      '1.3.0',
    )
    await activateRelease(installDir, '1.4.0')
    assert.strictEqual(
      await fs.readFile(path.join(current, 'which'), 'utf8'),
      '1.4.0',
    )
    // The old release is still there
    assert.strictEqual(
      await fs.readFile(
        path.join(releaseDir(installDir, '1.3.0'), 'which'),
        'utf8',
      ),
      '1.3.0',
    )
  })
})
