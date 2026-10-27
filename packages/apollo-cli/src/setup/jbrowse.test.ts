/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import {
  addFile,
  addOntology,
  parseConfigFileList,
  validateConfigFiles,
  validateJBrowseDir,
} from './jbrowse.js'

describe('JBrowse directory', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'apollo-jbrowse-test-'))
  let jbrowseDir = ''
  let count = 0

  beforeEach(async () => {
    jbrowseDir = path.join(root, `jbrowse${count++}`)
    await fs.mkdir(path.join(jbrowseDir, 'mouse'), { recursive: true })
    await fs.writeFile(path.join(jbrowseDir, 'index.html'), '<html></html>')
    await fs.writeFile(path.join(jbrowseDir, 'version.txt'), '4.3.0\n')
    await fs.writeFile(
      path.join(jbrowseDir, 'config.json'),
      '{"assemblies":[]}',
    )
    await fs.writeFile(path.join(jbrowseDir, 'mouse', 'mm.json'), '{}')
    await fs.writeFile(path.join(jbrowseDir, 'broken.json'), '{')
  })
  after(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('accepts a JBrowse Web directory', async () => {
    assert.strictEqual(await validateJBrowseDir(jbrowseDir), undefined)
  })

  it('rejects a directory without JBrowse, pointing to jbrowse create', async () => {
    await fs.rm(path.join(jbrowseDir, 'version.txt'))
    const error = await validateJBrowseDir(jbrowseDir)
    assert.match(error ?? '', /version\.txt/)
    assert.match(error ?? '', /jbrowse create/)
  })

  it('validates config files', async () => {
    assert.strictEqual(
      await validateConfigFiles(
        jbrowseDir,
        parseConfigFileList('config.json, mouse/mm.json'),
      ),
      undefined,
    )
    assert.match(
      (await validateConfigFiles(jbrowseDir, [])) ?? '',
      /at least one/,
    )
    assert.match(
      (await validateConfigFiles(jbrowseDir, ['missing.json'])) ?? '',
      /doesn't exist/,
    )
    assert.match(
      (await validateConfigFiles(jbrowseDir, ['broken.json'])) ?? '',
      /valid JSON/,
    )
    assert.match(
      (await validateConfigFiles(jbrowseDir, ['../config.json'])) ?? '',
      /inside the JBrowse directory/,
    )
  })

  it('adds a file, reuses an identical one, and never overwrites', async () => {
    const file = path.join(jbrowseDir, 'apollo-v1.3.0.js')
    assert.strictEqual(await addFile(file, Buffer.from('plugin')), 'added')
    assert.strictEqual(await addFile(file, Buffer.from('plugin')), 'unchanged')
    await assert.rejects(
      addFile(file, Buffer.from('different')),
      /already exists with different contents/,
    )
    assert.strictEqual(await fs.readFile(file, 'utf8'), 'plugin')
  })

  it('keeps an existing ontology without downloading', async () => {
    const ontology = path.join(jbrowseDir, 'sequence_ontology.json')
    await fs.writeFile(ontology, '{"mine":true}')
    assert.deepStrictEqual(await addOntology(jbrowseDir), {
      fileName: 'sequence_ontology.json',
      status: 'kept',
    })
    assert.strictEqual(await fs.readFile(ontology, 'utf8'), '{"mine":true}')
  })

  it('never touches config files', async () => {
    const before = await fs.stat(path.join(jbrowseDir, 'config.json'))
    await addFile(path.join(jbrowseDir, 'apollo-v1.3.0.js'), Buffer.from('x'))
    await fs.writeFile(path.join(jbrowseDir, 'sequence_ontology.json'), '{}')
    await addOntology(jbrowseDir)
    const after = await fs.stat(path.join(jbrowseDir, 'config.json'))
    assert.strictEqual(after.mtimeMs, before.mtimeMs)
    assert.strictEqual(
      await fs.readFile(path.join(jbrowseDir, 'config.json'), 'utf8'),
      '{"assemblies":[]}',
    )
  })
})
