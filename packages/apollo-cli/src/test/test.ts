/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * USAGE
 * From package root directory (`packages/apollo-cli`). Run all tests:
 *
 * yarn test:cli
 *
 * Run only matching pattern:
 *
 * yarn tsx --test-name-pattern='Print help|Feature get' src/test/test.ts
 */

import assert from 'node:assert'
import { spawn as spawnChildProcess } from 'node:child_process'
import * as crypto from 'node:crypto'
import fs from 'node:fs'
import { after, afterEach, before, beforeEach, describe } from 'node:test'

import type {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { MongoClient } from 'mongodb'

import { Shell, deleteAllChecks } from './utils.js'

const apollo = process.env.APOLLO_BIN ?? 'yarn dev'
const P = '--profile testAdmin'
// let client = MongoClient
let client: MongoClient
let configFile = ''
let configFileBak = ''

void describe('Test CLI', () => {
  before(() => {
    const uri =
      'mongodb://localhost:27017/apolloTestCliDb?directConnection=true'
    client = new MongoClient(uri)
    configFile = new Shell(`${apollo} config --get-config-file`).stdout.trim()
    configFileBak = `${configFile}.bak`
    if (fs.existsSync(configFileBak)) {
      throw new Error(
        `Backup config file ${configFileBak} already exists. If safe to do so, delete it before testing`,
      )
    }
    new Shell(`${apollo} config ${P} address http://localhost:3999`)
    new Shell(`${apollo} config ${P} accessType root`)
    new Shell(`${apollo} config ${P} rootPassword pass`)
    new Shell(`${apollo} login ${P} -f`)
  })

  after(async () => {
    await client.close()
  })

  beforeEach(() => {
    // Backup starting config file
    fs.copyFileSync(configFile, configFileBak)
  })

  afterEach(async () => {
    const database = client.db('apolloTestCliDb')
    await Promise.all(
      [
        'assemblies',
        'changes',
        'counters',
        'features',
        'files',
        'refseqchunks',
        'refseqs',
      ].map((collectionName) =>
        database.collection(collectionName).deleteMany({}),
      ),
    )
    // Put back starting config file
    fs.renameSync(configFileBak, configFile)
  })

  void globalThis.itName('Print help', () => {
    const p = new Shell(`${apollo} --help`)
    assert.ok(
      p.stdout.includes('COMMANDS'),
      `Expected help output to list COMMANDS:\n${p.stdout}`,
    )
  })

  void globalThis.itName('Get config file', () => {
    const p = new Shell(`${apollo} config --get-config-file`)
    assert.ok(
      p.stdout.startsWith('/'),
      `Expected an absolute config file path, got "${p.stdout}"`,
    )
  })

  void globalThis.itName('Config invalid keys', () => {
    let p = new Shell(`${apollo} config ${P} address spam`, false)
    assert.strictEqual(
      1,
      p.returncode,
      `Expected invalid address to exit with 1, got ${p.returncode}`,
    )
    assert.ok(
      p.stderr.includes('Invalid setting:'),
      `Expected "Invalid setting:" error for invalid address:\n${p.stderr}`,
    )

    p = new Shell(`${apollo} config ${P} ADDRESS http://localhost:3999`, false)
    assert.strictEqual(
      1,
      p.returncode,
      `Expected wrongly-cased key to exit with 1, got ${p.returncode}`,
    )
    assert.ok(
      p.stderr.includes('Invalid setting:'),
      `Expected "Invalid setting:" error for wrongly-cased key:\n${p.stderr}`,
    )

    p = new Shell(`${apollo} config ${P} accessType spam`, false)
    assert.strictEqual(
      1,
      p.returncode,
      `Expected invalid accessType to exit with 1, got ${p.returncode}`,
    )
    assert.ok(
      p.stderr.includes('Invalid setting:'),
      `Expected "Invalid setting:" error for invalid accessType:\n${p.stderr}`,
    )
  })

  void globalThis.itName('Can change access type', () => {
    const p = new Shell(`${apollo} config ${P} accessType google`)
    assert.strictEqual(
      '',
      p.stdout.trim(),
      `Expected no output when setting accessType, got "${p.stdout}"`,
    )
  })

  void globalThis.itName(
    'Interactive login type select shows names, not raw objects',
    async () => {
      // Regression test: /auth/types returns an array of
      // {name, needsPopup, message} objects, but selectAccessType() in
      // config.ts used to push those objects directly as a choice's `name`,
      // so the interactive select rendered "[object Object]" instead of the
      // login type name.
      const serverScript = 'test_data/tmp_auth_types_server.mjs'
      fs.writeFileSync(
        serverScript,
        `
import http from 'node:http'
const server = http.createServer((req, res) => {
  if (req.url === '/auth/types') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify([{ name: 'guest', needsPopup: false, message: 'Continue as Guest' }]))
    return
  }
  res.writeHead(404)
  res.end()
})
server.listen(0, () => {
  console.log(server.address().port)
})
`,
      )
      const authServer = spawnChildProcess('node', [serverScript])
      const authPort: string = await new Promise((resolve) => {
        authServer.stdout.once('data', (data: Buffer) => {
          resolve(data.toString().trim())
        })
      })

      const child = spawnChildProcess(`${apollo} config ${P}`, {
        shell: '/bin/bash',
      })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      const waitFor = (pattern: string, timeoutMs = 15_000) =>
        new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            clearInterval(interval)
            reject(
              new Error(
                `Timed out waiting for "${pattern}". Stdout so far:\n${stdout}\nStderr so far:\n${stderr}`,
              ),
            )
          }, timeoutMs)
          const interval = setInterval(() => {
            if (stdout.includes(pattern)) {
              clearInterval(interval)
              clearTimeout(timer)
              resolve()
            }
          }, 50)
        })

      try {
        await waitFor('Server address and port')
        child.stdin.write(`http://localhost:${authPort}\r`)

        await waitFor('Select login type')
        // Move the selection down from the default "root" choice onto the
        // mock server's "guest" login type, then confirm it.
        child.stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 500))
        child.stdin.write('\r')

        const exitCode: number | null = await new Promise((resolve) => {
          child.on('exit', resolve)
        })

        assert.strictEqual(
          exitCode,
          0,
          `Expected "apollo config" to exit cleanly. Stdout:\n${stdout}\nStderr:\n${stderr}`,
        )
        assert.ok(
          !stdout.includes('[object Object]'),
          `Select choices rendered a raw object instead of its name:\n${stdout}`,
        )
        assert.ok(
          stdout.includes('guest'),
          `Expected "guest" login type to be shown as a choice:\n${stdout}`,
        )
      } finally {
        child.kill()
        authServer.kill()
        fs.unlinkSync(serverScript)
      }

      const p = new Shell(`${apollo} config ${P} accessType`)
      assert.strictEqual(
        p.stdout.trim(),
        'guest',
        `Expected selected accessType to be saved as "guest", got "${p.stdout.trim()}"`,
      )
    },
  )

  void globalThis.itName('Apollo status', () => {
    let p = new Shell(`${apollo} status ${P}`)
    assert.strictEqual(
      p.stdout.trim(),
      'testAdmin: Logged in',
      `Expected status to be logged in, got "${p.stdout.trim()}"`,
    )

    new Shell(`${apollo} logout ${P}`)
    p = new Shell(`${apollo} status ${P}`)
    assert.strictEqual(
      p.stdout.trim(),
      'testAdmin: Logged out',
      `Expected status to be logged out after logout, got "${p.stdout.trim()}"`,
    )

    new Shell(`${apollo} login ${P} -f`)
  })

  void globalThis.itName('Feature get', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv2 -f`,
    )

    let p = new Shell(`${apollo} feature get ${P} -a vv1`)
    assert.ok(
      p.stdout.includes('ctgA'),
      'Expected features of vv1 to include refseq ctgA',
    )
    assert.ok(
      p.stdout.includes('SomeContig'),
      'Expected features of vv1 to include SomeContig',
    )

    p = new Shell(`${apollo} feature get ${P} -r ctgA`, false)
    assert.ok(
      p.returncode != 0,
      'Expected feature get with refseq in multiple assemblies to fail',
    )
    assert.ok(
      p.stderr.includes('found in more than one assembly'),
      `Expected ambiguous refseq error:\n${p.stderr}`,
    )

    p = new Shell(`${apollo} feature get ${P} -a vv1 -r ctgA`)
    let out = JSON.parse(p.stdout)
    assert.ok(
      Object.keys(out.at(0)).length > 2,
      `Expected first feature to have more than 2 keys, got ${Object.keys(out.at(0)).length}`,
    )

    p = new Shell(`${apollo} feature get ${P} -a vv1 -r ctgA -s 40 -e 41`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 feature in ctgA:40..41, got ${out.length}`,
    )

    p = new Shell(`${apollo} feature get ${P} -a vv1 -r ctgA -s 1000 -e 1000`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      out,
      [],
      `Expected no features in ctgA:1000..1000, got ${out.length}`,
    )

    p = new Shell(`${apollo} feature get ${P} -r FOOBAR`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      out,
      [],
      `Expected no features for non-existent refseq, got ${out.length}`,
    )

    p = new Shell(`${apollo} feature get ${P} -a FOOBAR -r ctgA`, false)
    assert.ok(
      p.returncode != 0,
      'Expected feature get with non-existent assembly to fail',
    )
    assert.ok(
      p.stderr.includes('returned 0 assemblies'),
      `Expected "returned 0 assemblies" error:\n${p.stderr}`,
    )
  })

  void globalThis.itName('Assembly get', () => {
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv1 -e -f`,
    )
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv2 -e -f`,
    )
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv3 -e -f`,
    )
    let p = new Shell(`${apollo} assembly get ${P}`)
    assert.ok(
      p.stdout.includes('vv1'),
      'Expected all assemblies to include vv1',
    )
    assert.ok(
      p.stdout.includes('vv2'),
      'Expected all assemblies to include vv2',
    )
    assert.ok(
      p.stdout.includes('vv3'),
      'Expected all assemblies to include vv3',
    )

    p = new Shell(`${apollo} assembly get ${P} -a vv1 vv2`)
    assert.ok(
      p.stdout.includes('vv1'),
      'Expected selected assemblies to include vv1',
    )
    assert.ok(
      p.stdout.includes('vv2'),
      'Expected selected assemblies to include vv2',
    )
    assert.ok(
      p.stdout.includes('vv3') == false,
      'Expected unselected assembly vv3 not to be returned',
    )

    const out = JSON.parse(p.stdout)
    const aid = out.find((x: any) => x.name === 'vv1')._id
    p = new Shell(`${apollo} assembly get ${P} -a ${aid} vv2`)
    assert.ok(
      p.stdout.includes('vv1'),
      'Expected assembly selected by id to include vv1',
    )
    assert.ok(
      p.stdout.includes('vv2'),
      'Expected assembly selected by name to include vv2',
    )
    assert.ok(
      p.stdout.includes('vv3') == false,
      'Expected unselected assembly vv3 not to be returned',
    )
  })

  void globalThis.itName('Delete assembly', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a volvox1 -f`,
    )
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a volvox2 -f`,
    )
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a volvox3 -f`,
    )
    let p = new Shell(
      `${apollo} assembly get ${P} | jq '.[] | select(.name == "volvox1") | ._id'`,
    )
    const aid = p.stdout.trim()

    p = new Shell(`${apollo} assembly delete ${P} -v -a ${aid} volvox2 volvox2`)
    const out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 deleted assemblies (duplicates ignored), got ${out.length}`,
    )
    assert.ok(
      p.stderr.includes('2 '),
      `Expected verbose output to report 2 deletions:\n${p.stderr}`,
    )

    new Shell(`${apollo} assembly delete ${P} -a ${aid} volvox2`)
    p = new Shell(`${apollo} assembly get ${P}`)
    assert.ok(
      p.stdout.includes(aid) == false,
      `Expected deleted assembly id ${aid} not to be returned`,
    )
    assert.ok(
      p.stdout.includes('volvox1') == false,
      'Expected deleted assembly volvox1 not to be returned',
    )
    assert.ok(
      p.stdout.includes('volvox2') == false,
      'Expected deleted assembly volvox2 not to be returned',
    )
    assert.ok(
      p.stdout.includes('volvox3'),
      'Expected non-deleted assembly volvox3 to be returned',
    )
  })

  void globalThis.itName('Id reader', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v1 -f`,
    )
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v2 -f`,
    )
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v3 -f`,
    )
    let p = new Shell(`${apollo} assembly get ${P}`)
    const xall = JSON.parse(p.stdout)

    p = new Shell(`${apollo} assembly get ${P} -a v1 v2`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 assemblies from command-line names, got ${out.length}`,
    )

    // This is interpreted as an assembly named 'v1 v2'
    p = new Shell(`echo v1 v2 | ${apollo} assembly get ${P} -a -`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      0,
      `Expected 0 assemblies for single stdin line "v1 v2", got ${out.length}`,
    )

    // These are two assemblies
    p = new Shell(`echo -e 'v1 \n v2' | ${apollo} assembly get ${P} -a -`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 assemblies from two stdin lines, got ${out.length}`,
    )

    p = new Shell(
      `${apollo} assembly get ${P} | ${apollo} assembly get ${P} -a -`,
    )
    out = JSON.parse(p.stdout)
    assert.ok(
      out.length >= 3,
      `Expected at least 3 assemblies from piped JSON, got ${out.length}`,
    )

    // From json file
    new Shell(`${apollo} assembly get ${P} > test_data/tmp.json`)
    p = new Shell(`${apollo} assembly get ${P} -a test_data/tmp.json`)
    out = JSON.parse(p.stdout)
    assert.ok(
      out.length >= 3,
      `Expected at least 3 assemblies from JSON file, got ${out.length}`,
    )
    fs.unlinkSync('test_data/tmp.json')

    // From text file, one name or id per line
    fs.writeFileSync('test_data/tmp.txt', 'v1 \n v2 \r\n v3 \n')
    p = new Shell(`${apollo} assembly get ${P} -a test_data/tmp.txt`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      3,
      `Expected 3 assemblies from text file, got ${out.length}`,
    )
    fs.unlinkSync('test_data/tmp.txt')

    // From json string
    const aid = xall.at(0)._id
    let j = `{"_id": "${aid}"}`
    p = new Shell(`${apollo} assembly get ${P} -a '${j}'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 assembly from JSON object string, got ${out.length}`,
    )
    assert.strictEqual(
      out.at(0)._id,
      aid,
      `Expected assembly id ${aid}, got ${out.at(0)._id}`,
    )

    const id1 = xall.at(0)._id
    const id2 = xall.at(1)._id
    j = `[{"_id": "${id1}"}, {"_id": "${id2}"}]`
    p = new Shell(`${apollo} assembly get ${P} -a '${j}'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 assemblies from JSON array string, got ${out.length}`,
    )

    j = `{"XYZ": "${aid}"}`
    p = new Shell(`${apollo} assembly get ${P} -a '${j}'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      0,
      `Expected 0 assemblies from JSON without _id, got ${out.length}`,
    )

    p = new Shell(`${apollo} assembly get ${P} -a '[...'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      0,
      `Expected 0 assemblies from malformed JSON, got ${out.length}`,
    )
  })

  void globalThis.itName('Add assembly from gff', () => {
    let p = new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 --omit-features -f`,
    )
    const out = JSON.parse(p.stdout)
    assert.ok(
      Object.keys(out.fileIds).includes('fa'),
      `Expected added assembly to have an "fa" file id, got ${JSON.stringify(out.fileIds)}`,
    )

    // Get id of assembly named vv1 and check there are no features
    p = new Shell(`${apollo} assembly get ${P} -a vv1`)
    assert.ok(p.stdout.includes('vv1'), 'Expected assembly vv1 to be returned')
    assert.ok(
      p.stdout.includes('vv2') == false,
      'Expected only assembly vv1 to be returned',
    )
    const asm_id = JSON.parse(p.stdout).at(0)._id

    p = new Shell(`${apollo} refseq get ${P}`)
    const refseq = JSON.parse(p.stdout.trim())
    const vv1ref = refseq.filter((x: any) => x.assembly === asm_id)
    const refseq_id = vv1ref.find((x: any) => x.name === 'ctgA')._id

    p = new Shell(`${apollo} feature get ${P} -r ${refseq_id}`)
    const ff = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      ff,
      [],
      `Expected no features with --omit-features, got ${ff.length}`,
    )

    p = new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected adding existing assembly without -f to fail',
    )
    assert.ok(
      p.stderr.includes('Error: Assembly "vv1" already exists'),
      `Expected "already exists" error:\n${p.stderr}`,
    )

    // Default assembly name
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -f`,
    )
    p = new Shell(`${apollo} assembly get ${P} -a tiny.fasta.gff3`)
    assert.ok(
      p.stdout.includes('tiny.fasta.gff3'),
      'Expected assembly name to default to the file name',
    )
  })

  void globalThis.itName('Add assembly large input', () => {
    fs.writeFileSync('test_data/tmp.fa', '>chr1\n')
    const stream = fs.createWriteStream('test_data/tmp.fa', { flags: 'a' })
    for (let i = 0; i < 10_000; i++) {
      stream.write('CATTGTTGCGGAGTTGAACAACGGCATTAGGAACACTTCCGTCTC\n')
    }
    stream.close()

    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tmp.fa -a test -e -f`,
      true,
      60_000,
    )

    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tmp.fa -a test -f`,
      false,
      60_000,
    )
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tmp.fa -a test -e -f`,
      true,
      60_000,
    )

    fs.unlinkSync('test_data/tmp.fa')
  })

  void globalThis.itName('Checks are triggered and resolved', () => {
    new Shell(`${apollo} assembly add-from-gff ${P} test_data/checks.gff -f`)
    let p = new Shell(`${apollo} feature get ${P} -a checks.gff`)
    const out = JSON.parse(p.stdout)

    p = new Shell(`${apollo} feature check ${P} -a checks.gff`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected no failing checks initially, got:\n${p.stdout}`,
    )

    // Get the ID of the CDS. We need need it to modify the CDS coordinates
    const gene = out.filter(
      (x: any) =>
        JSON.stringify(x.attributes.gff_id) === JSON.stringify(['gene01']),
    )
    const mrna = Object.values(gene.at(0).children).at(0) as any
    const cds = Object.values(mrna.children).find(
      (x: any) => x.attributes.gff_id.at(0) === 'cds01',
    ) as any
    const cds_id = cds._id

    // Introduce problems
    new Shell(
      `${apollo} feature edit-coords ${P} -i ${cds_id} --start 4 --end 24`,
    )
    p = new Shell(`${apollo} feature check ${P} -a checks.gff`)
    const checks = JSON.parse(p.stdout)
    assert.strictEqual(
      checks.length,
      2,
      `Expected 2 failing checks after breaking CDS, got ${checks.length}`,
    )
    assert.ok(
      p.stdout.includes('InternalStopCodon'),
      `Expected an InternalStopCodon check:\n${p.stdout}`,
    )
    assert.ok(
      p.stdout.includes('MissingStopCodon'),
      `Expected a MissingStopCodon check:\n${p.stdout}`,
    )

    // Problems fixed
    new Shell(
      `${apollo} feature edit-coords ${P} -i ${cds_id} --start 16 --end 27`,
    )
    p = new Shell(`${apollo} feature check ${P} -a checks.gff`)
    assert.deepStrictEqual(
      JSON.parse(p.stdout).length,
      0,
      `Expected no failing checks after fixing CDS, got:\n${p.stdout}`,
    )
  })

  void globalThis.itName('FIXME: Checks stay after invalid operation', () => {
    new Shell(`${apollo} assembly add-from-gff ${P} test_data/checks.gff -f`)
    let p = new Shell(`${apollo} feature get ${P} -a checks.gff`)
    const out = JSON.parse(p.stdout)

    p = new Shell(`${apollo} feature check ${P} -a checks.gff`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected no failing checks initially, got:\n${p.stdout}`,
    )

    // Get the ID of the CDS. We need need it to modify the CDS coordinates
    const gene = out.filter(
      (x: any) =>
        JSON.stringify(x.attributes.gff_id) === JSON.stringify(['gene01']),
    )
    const mrna = Object.values(gene.at(0).children).at(0) as any
    const cds = Object.values(mrna.children).find(
      (x: any) => x.attributes.gff_id.at(0) === 'cds01',
    ) as any
    const cds_id = cds._id

    // Introduce problems
    new Shell(
      `${apollo} feature edit-coords ${P} -i ${cds_id} --start 4 --end 24`,
    )
    p = new Shell(`${apollo} feature check ${P} -a checks.gff`)
    const checks = JSON.parse(p.stdout)
    assert.strictEqual(
      checks.length,
      2,
      `Expected 2 failing checks after breaking CDS, got ${checks.length}`,
    )
    assert.ok(
      p.stdout.includes('InternalStopCodon'),
      `Expected an InternalStopCodon check:\n${p.stdout}`,
    )
    assert.ok(
      p.stdout.includes('MissingStopCodon'),
      `Expected a MissingStopCodon check:\n${p.stdout}`,
    )

    // Do something invalid: extend CDS beyond parent
    p = new Shell(
      `${apollo} feature edit-coords ${P} -i ${cds_id} --end 30`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected extending CDS beyond its parent to fail',
    )
    assert.ok(
      p.stderr.includes('exceeds the bounds of its parent'),
      `Expected "exceeds the bounds of its parent" error:\n${p.stderr}`,
    )

    // FIXME: Checks should be the same as before the invalid edit
    // p = new Shell(`${apollo} feature check ${P} -a checks.gff`)
    // checks = JSON.parse(p.stdout)
    //assert.strictEqual(checks.length, 2)
    //assert.ok(p.stdout.includes('InternalStopCodon'))
    //assert.ok(p.stdout.includes('MissingStopCodon'))
  })

  void globalThis.itName('Add assembly from local fasta', () => {
    let p = new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv1 -e -f`,
    )
    const out = JSON.parse(p.stdout)
    assert.ok(
      Object.keys(out.fileIds).includes('fa'),
      `Expected added assembly to have an "fa" file id, got ${JSON.stringify(out.fileIds)}`,
    )

    p = new Shell(`${apollo} assembly get ${P} -a vv1`)
    assert.ok(p.stdout.includes('vv1'), 'Expected assembly vv1 to be returned')
    p = new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv1 -e`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected adding existing assembly without -f to fail',
    )
    assert.ok(
      p.stderr.includes('Error: Assembly "vv1" already exists'),
      `Expected "already exists" error:\n${p.stderr}`,
    )

    p = new Shell(
      `${apollo} assembly add-from-fasta ${P} na.fa -a vv1 -e -f`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected adding assembly from non-existent file to fail',
    )
    assert.ok(
      p.stderr.includes('Input'),
      `Expected an error about the input file:\n${p.stderr}`,
    )

    // Test default name
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -e -f`,
    )
    p = new Shell(`${apollo} assembly get ${P} -a tiny.fasta`)
    assert.ok(
      p.stdout.includes('tiny.fasta'),
      'Expected assembly name to default to the file name',
    )
  })

  void globalThis.itName('Add assembly from external fasta', () => {
    let p = new Shell(
      `${apollo} assembly add-from-fasta ${P} -a vv1 -f http://localhost:3131/volvox.fa.gz`,
    )
    const out = JSON.parse(p.stdout)
    assert.ok(
      Object.keys(out.externalLocation).includes('fa'),
      `Expected added assembly to have an external "fa" location, got ${JSON.stringify(out.externalLocation)}`,
    )

    p = new Shell(`${apollo} assembly get ${P} -a vv1`)
    assert.ok(p.stdout.includes('vv1'), 'Expected assembly vv1 to be returned')

    p = new Shell(`${apollo} assembly sequence ${P} -a vv1 -r ctgA -s 1 -e 10`)
    const seq = p.stdout.split(' ')
    assert.strictEqual(
      seq[1],
      'cattgttgcg',
      `Unexpected sequence for ctgA:1..10: "${seq[1]}"`,
    )

    p = new Shell(
      `${apollo} assembly add-from-fasta ${P} -a vv1 -f https://x.fa.gz --fai https://x.fa.gz.fai --gzi https://x.fa.gz.gzi`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected adding assembly from unreachable URLs to fail',
    )
  })

  void globalThis.itName('Detect missing external index', () => {
    const p = new Shell(
      `${apollo} assembly add-from-fasta ${P} -a vv1 -f http://localhost:3131/tiny.fasta`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected adding external fasta without index to fail',
    )
    assert.ok(
      p.stderr.includes('Index file does not exist'),
      `Expected "Index file does not exist" error:\n${p.stderr}`,
    )
  })

  void globalThis.itName(
    'Editable sequence not allowed with external source',
    () => {
      const cmd = `${apollo} assembly add-from-fasta ${P} -a vv1 -f http://localhost:3131/tiny.fasta.gz`
      new Shell(cmd)

      const p = new Shell(`${cmd} -e`, false)
      assert.ok(
        p.returncode != 0,
        'Expected adding external fasta as editable to fail',
      )
      assert.ok(
        p.stderr.includes('External fasta files are not editable'),
        `Expected "External fasta files are not editable" error:\n${p.stderr}`,
      )
    },
  )

  void globalThis.itName('Edit feature from json', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    let p = new Shell(`${apollo} feature search ${P} -a vv1 -t BAC`)
    let out = JSON.parse(p.stdout).at(0)
    assert.strictEqual(
      out.type,
      'BAC',
      `Expected feature of type BAC, got ${out.type}`,
    )

    p = new Shell(`${apollo} assembly get ${P} -a vv1`)
    const asm_id = JSON.parse(p.stdout).at(0)._id

    const req = [
      {
        typeName: 'TypeChange',
        changedIds: [out._id],
        assembly: asm_id,
        featureId: out._id,
        oldType: 'BAC',
        newType: 'G_quartet',
      },
    ]
    const j = JSON.stringify(req)
    new Shell(`echo '${j}' | ${apollo} feature edit ${P} -j -`)
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t G_quartet`)
    out = JSON.parse(p.stdout).at(0)
    assert.strictEqual(
      out.type,
      'G_quartet',
      `Expected feature type to be changed to G_quartet, got ${out.type}`,
    )
  })

  void globalThis.itName('Edit feature type', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )

    // Get id of assembly named vv1
    let p = new Shell(`${apollo} assembly get ${P} -a vv1`)
    const asm_id = JSON.parse(p.stdout).at(0)._id

    // Get refseqs in assembly vv1
    p = new Shell(
      `${apollo} refseq get ${P} | jq '.[] | select(.assembly == "${asm_id}" and .name == "ctgA") | ._id'`,
    )
    const refseq = p.stdout.trim()

    // Get feature in vv1
    p = new Shell(`${apollo} feature get ${P} -r ${refseq}`)
    const features = JSON.parse(p.stdout)
    assert.ok(
      features.length > 2,
      `Expected more than 2 features in ctgA, got ${features.length}`,
    )

    // Get id of feature of type contig
    let contig = features.filter((x: any) => x.type === 'contig')
    assert.strictEqual(
      contig.length,
      1,
      `Expected 1 contig feature, got ${contig.length}`,
    )
    const contig_id = contig.at(0)._id

    // Edit type of "contig" feature
    new Shell(`${apollo} feature edit-type ${P} -i ${contig_id} -t region`)

    p = new Shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(._id == "${contig_id}")'`,
    )
    contig = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      contig.type,
      'region',
      `Expected feature type to be changed to region, got ${contig.type}`,
    )

    // Return current type
    p = new Shell(`${apollo} feature edit-type ${P} -i ${contig_id}`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      'region',
      `Expected edit-type without -t to print current type, got "${p.stdout.trim()}"`,
    )
  })

  void globalThis.itName('Edit feature coords', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )

    // Get id of assembly named vv1
    let p = new Shell(`${apollo} assembly get ${P} -a vv1`)
    const asm_id = JSON.parse(p.stdout).at(0)._id

    // Get refseqs in assembly vv1
    p = new Shell(
      `${apollo} refseq get ${P} | jq '.[] | select(.assembly == "${asm_id}" and .name == "ctgA") | ._id'`,
    )
    const refseq = p.stdout.trim()

    // Get feature in vv1
    p = new Shell(`${apollo} feature get ${P} -r ${refseq}`)
    const features = JSON.parse(p.stdout)
    assert.ok(
      features.length > 2,
      `Expected more than 2 features in ctgA, got ${features.length}`,
    )

    // Get id of feature of type contig
    let contig = features.filter((x: any) => x.type === 'contig')
    assert.strictEqual(
      contig.length,
      1,
      `Expected 1 contig feature, got ${contig.length}`,
    )
    const contig_id = contig.at(0)._id

    // Edit start and end coordinates
    new Shell(`${apollo} feature edit-coords ${P} -i ${contig_id} -s 80 -e 160`)
    new Shell(`${apollo} feature edit-coords ${P} -i ${contig_id} -s 20 -e 100`)

    p = new Shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(._id == "${contig_id}")'`,
    )
    contig = JSON.parse(p.stdout)
    assert.strictEqual(
      contig.min,
      20 - 1,
      `Expected 0-based min of 19 after setting start to 20, got ${contig.min}`,
    )
    assert.strictEqual(
      contig.max,
      100,
      `Expected max of 100 after setting end to 100, got ${contig.max}`,
    )

    new Shell(`${apollo} feature edit-coords ${P} -i ${contig_id} -s 1 -e 1`)
    p = new Shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(._id == "${contig_id}")'`,
    )
    contig = JSON.parse(p.stdout)
    assert.strictEqual(
      contig.min,
      0,
      `Expected 0-based min of 0 after setting start to 1, got ${contig.min}`,
    )
    assert.strictEqual(
      contig.max,
      1,
      `Expected max of 1 after setting end to 1, got ${contig.max}`,
    )

    p = new Shell(
      `${apollo} feature edit-coords ${P} -i ${contig_id} -s 0`,
      false,
    )
    assert.strictEqual(
      p.returncode,
      2,
      `Expected start of 0 to exit with 2, got ${p.returncode}`,
    )
    assert.ok(
      p.stderr.includes('Coordinates must be greater than 0'),
      `Expected "Coordinates must be greater than 0" error:\n${p.stderr}`,
    )

    p = new Shell(
      `${apollo} feature edit-coords ${P} -i ${contig_id} -s 10 -e 9`,
      false,
    )
    assert.strictEqual(
      p.returncode,
      2,
      `Expected end lower than start to exit with 2, got ${p.returncode}`,
    )
    assert.ok(
      p.stderr.includes(
        'Error: The new end coordinate is lower than the new start coordinate',
      ),
      `Expected "end coordinate is lower than start" error:\n${p.stderr}`,
    )

    // Edit a feature by extending beyond the boundary of its parent and
    // check it throws a meaningful error message
    // let eden_gene = undefined
    const eden_gene = features.find(
      (x: any) => x.type === 'gene' && x.attributes.gff_name.at(0) === 'EDEN',
    )
    assert.ok(eden_gene, 'Expected to find gene EDEN')
    const mrna_id = Object.keys(eden_gene.children).at(0)
    p = new Shell(
      `${apollo} feature edit-coords ${P} -i ${mrna_id} -s 1`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected extending mRNA beyond its parent to fail',
    )
    assert.ok(
      p.stderr.includes('exceeds the bounds of its parent'),
      `Expected "exceeds the bounds of its parent" error:\n${p.stderr}`,
    )
  })

  void globalThis.itName('Edit attributes', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )

    // Get id of assembly named vv1
    let p = new Shell(`${apollo} assembly get ${P} -a vv1`)
    const asm_id = JSON.parse(p.stdout).at(0)._id

    p = new Shell(
      `${apollo} refseq get ${P} | jq '.[] | select(.assembly == "${asm_id}" and .name == "ctgA") | ._id'`,
    )
    const refseq = p.stdout.trim()

    // Get feature in vv1
    p = new Shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(.type == "contig") | ._id'`,
    )
    const fid = p.stdout.trim()

    // Edit existing attribute value
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a source -v 'Eggs & Stuff'`,
    )
    p = new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a source`)
    let out = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      out.at(0),
      `Eggs & Stuff`,
      `Expected edited source attribute "Eggs & Stuff", got ${JSON.stringify(out)}`,
    )

    // Add attribute
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -v stuff`,
    )
    p = new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr`)
    assert.ok(
      p.stdout.includes('stuf'),
      `Expected new attribute value "stuff", got "${p.stdout.trim()}"`,
    )

    // Non existing attr
    p = new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a NonExist`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '',
      `Expected no output for non-existent attribute, got "${p.stdout.trim()}"`,
    )

    // List of values
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -v A B C`,
    )
    p = new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      out,
      ['A', 'B', 'C'],
      `Expected attribute values [A, B, C], got ${JSON.stringify(out)}`,
    )

    // Delete attribute
    new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -d`)
    p = new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '',
      `Expected no output for deleted attribute, got "${p.stdout.trim()}"`,
    )
    // Delete again is ok
    new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -d`)

    // Special fields
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a 'Gene Ontology' -v GO:0051728 GO:0019090`,
    )
    p = new Shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a 'Gene Ontology'`,
    )
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      out,
      ['GO:0051728', 'GO:0019090'],
      `Expected Gene Ontology values [GO:0051728, GO:0019090], got ${JSON.stringify(out)}`,
    )

    // This should fail
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a 'Gene Ontology' -v FOOBAR`,
    )
  })

  void globalThis.itName('Search features', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv2 -f`,
    )

    let p = new Shell(`${apollo} feature search ${P} -a vv1 vv2 -t EDEN`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 EDEN matches across vv1 and vv2, got ${out.length}`,
    )
    assert.ok(
      p.stdout.includes('EDEN'),
      'Expected search results to include EDEN',
    )

    p = new Shell(`${apollo} feature search ${P} -t EDEN`)
    out = JSON.parse(p.stdout)
    assert.ok(
      out.length >= 2,
      `Expected at least 2 EDEN matches across all assemblies, got ${out.length}`,
    )

    p = new Shell(`${apollo} feature search ${P} -a vv1 -t EDEN`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 EDEN match in vv1, got ${out.length}`,
    )
    assert.ok(
      p.stdout.includes('EDEN'),
      'Expected search results to include EDEN',
    )

    p = new Shell(`${apollo} feature search ${P} -a foobar -t EDEN`)
    assert.strictEqual(
      '[]',
      p.stdout.trim(),
      `Expected no results for non-existent assembly, got:\n${p.stdout}`,
    )
    assert.ok(
      p.stderr.includes('Warning'),
      `Expected a warning for non-existent assembly:\n${p.stderr}`,
    )

    p = new Shell(`${apollo} feature search ${P} -a vv1 -t foobarspam`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected no results for unmatched term, got:\n${p.stdout}`,
    )

    // It searches attributes values, not attribute names
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t multivalue`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected attribute names not to be searched, got:\n${p.stdout}`,
    )

    // Search feature type
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    assert.ok(
      p.stdout.includes('"type": "contig"'),
      'Expected search by type to return a contig feature',
    )

    // Search source (which in fact is an attribute)
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t someExample`)
    assert.ok(
      p.stdout.includes('SomeContig'),
      'Expected search by source to return SomeContig',
    )

    // Case insensitive
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t SOMEexample`)
    assert.ok(
      p.stdout.includes('SomeContig'),
      'Expected case-insensitive search to return SomeContig',
    )

    // No partial word match
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t Fingerpri`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected no results for partial word, got:\n${p.stdout}`,
    )

    // Match full word not necessarily full value
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t Fingerprinted`)
    assert.ok(
      p.stdout.includes('Fingerprinted'),
      'Expected full-word search to match part of a value',
    )

    // Does not search contig names (reference sequence name)
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t ctgB`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected refseq names not to be searched, got:\n${p.stdout}`,
    )

    // Does not match common words (?) ...
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t with`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected common words not to be matched, got:\n${p.stdout}`,
    )

    // ...But "fake" is ok
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t fake`)
    assert.ok(
      p.stdout.includes('FakeSNP1'),
      'Expected search for "fake" to return FakeSNP1',
    )

    // ...or a single unusual letter
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t Q`)
    assert.ok(
      p.stdout.includes('"Q"'),
      'Expected search for single letter "Q" to match',
    )
  })

  void globalThis.itName('Get feature by indexed ID', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv2 -f`,
    )

    // Search multiple assemblies
    let p = new Shell(`${apollo} feature get-indexed-id ${P} MyGene -a vv1 vv2`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 MyGene matches across vv1 and vv2, got ${out.length}`,
    )
    assert.ok(p.stdout.includes('MyGene'), 'Expected results to include MyGene')

    // Specifying no assembly defaults to searching all assemblies
    p = new Shell(`${apollo} feature get-indexed-id ${P} MyGene`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 MyGene matches across all assemblies, got ${out.length}`,
    )
    assert.ok(p.stdout.includes('MyGene'), 'Expected results to include MyGene')

    // Search single assembly
    p = new Shell(`${apollo} feature get-indexed-id ${P} MyGene -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 MyGene match in vv1, got ${out.length}`,
    )
    assert.ok(p.stdout.includes('MyGene'), 'Expected results to include MyGene')

    // Warn on unknown assembly
    p = new Shell(`${apollo} feature get-indexed-id ${P} EDEN -a foobar`)
    assert.strictEqual(
      '[]',
      p.stdout.trim(),
      `Expected no results for non-existent assembly, got:\n${p.stdout}`,
    )
    assert.ok(
      p.stderr.includes('Warning'),
      `Expected a warning for non-existent assembly:\n${p.stderr}`,
    )

    // Return empty array with no matches
    p = new Shell(`${apollo} feature get-indexed-id ${P} foobarspam -a vv1`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected no results for unmatched id, got:\n${p.stdout}`,
    )

    // Gets subfeature
    p = new Shell(`${apollo} feature get-indexed-id ${P} myCDS.1 -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 match for myCDS.1, got ${out.length}`,
    )
    assert.ok(
      out.at(0)?.type === 'CDS',
      `Expected subfeature of type CDS, got ${out.at(0)?.type}`,
    )

    // Gets top-level feature from subfeature id
    p = new Shell(
      `${apollo} feature get-indexed-id ${P} myCDS.1 -a vv1 --topLevel`,
    )
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 top-level match for myCDS.1, got ${out.length}`,
    )
    assert.ok(
      out.at(0)?.type === 'gene',
      `Expected top-level feature of type gene, got ${out.at(0)?.type}`,
    )

    // Gets feature and child feature that were added manually (not imported)
    new Shell(
      `${apollo} feature add ${P} <<EOF
{
  "assembly": "vv1",
  "refSeq": "ctgA",
  "min": 301,
  "max": 310,
  "type": "match",
  "attributes": {"gff_id": ["match1"]},
  "children": [
    {
      "min": 301,
      "max": 305,
      "type": "match_part",
      "attributes": {"gff_id": ["matchPart1"]}
    }
  ]
}
EOF`,
    )
    p = new Shell(`${apollo} feature get-indexed-id ${P} match1 -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 match for manually added match1, got ${out.length}`,
    )
    assert.ok(p.stdout.includes('match1'), 'Expected results to include match1')
    p = new Shell(`${apollo} feature get-indexed-id ${P} matchPart1 -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 match for manually added matchPart1, got ${out.length}`,
    )
    assert.ok(
      p.stdout.includes('matchPart1'),
      'Expected results to include matchPart1',
    )

    // Doesn't get child feature after it was deleted
    const idToDelete = out[0]._id
    new Shell(`${apollo} feature delete ${P} -i ${idToDelete}`)
    p = new Shell(`${apollo} feature get-indexed-id ${P} matchPart1 -a vv1`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected deleted child matchPart1 not to be found, got:\n${p.stdout}`,
    )

    // Gets feature after ID was manually added
    p = new Shell(
      `${apollo} feature add ${P} <<EOF
{
  "assembly": "vv1",
  "refSeq": "ctgA",
  "min": 311,
  "max": 320,
  "type": "match"
}
EOF`,
    )
    out = JSON.parse(p.stdout)
    const { assembly, changes } = out
    const { _id, refSeq } = changes[0].addedFeature
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${_id} -a gff_id -v match2`,
    )
    p = new Shell(`${apollo} feature get-indexed-id ${P} match2 -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 match for match2 after adding its ID, got ${out.length}`,
    )
    assert.ok(p.stdout.includes('match2'), 'Expected results to include match2')

    // Gets child featuer after it was added with an ID
    // add-child CLI command doesn't support adding attributes yet, so we'll
    // manually do it with curl for testing for neow
    p = new Shell(`${apollo} config ${P} accessToken`)
    const token = p.stdout.trim()
    const newChildFeatureID = '69408088d502fc21aea1bb0a'
    new Shell(
      `curl -X POST http://127.0.0.1:3999/changes -d '{"typeName":"AddFeatureChange","changedIds":["${newChildFeatureID}"],"assembly":"${assembly}","addedFeature":{"_id":"${newChildFeatureID}","refSeq":"${refSeq}","min":311,"max":315,"type":"match_part","attributes":{"gff_id":["matchPart2"]}},"parentFeatureId":"${_id}"}' -H "Content-Type: application/json" -H "Authorization: Bearer ${token}"`,
    )
    p = new Shell(`${apollo} feature get-indexed-id ${P} matchPart2 -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 match for child matchPart2 added with an ID, got ${out.length}`,
    )
    assert.ok(
      p.stdout.includes('matchPart2'),
      'Expected results to include matchPart2',
    )

    // Doesn't get feature or child after IDs were manually removed
    new Shell(`${apollo} feature edit-attribute ${P} -i ${_id} -a gff_id -d`)
    const childId = out[0]._id
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${childId} -a gff_id -d`,
    )
    p = new Shell(`${apollo} feature get-indexed-id ${P} match2 -a vv1`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected match2 not to be found after removing its ID, got:\n${p.stdout}`,
    )
    p = new Shell(`${apollo} feature get-indexed-id ${P} matchPart2 -a vv1`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected matchPart2 not to be found after removing its ID, got:\n${p.stdout}`,
    )
  })

  void globalThis.itName('Delete features', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    let p = new Shell(`${apollo} feature search ${P} -a vv1 -t EDEN`)
    const fid = JSON.parse(p.stdout).at(0)._id

    p = new Shell(`${apollo} feature delete ${P} -i ${fid} --dry-run`)
    assert.ok(
      p.stdout.includes(fid),
      `Expected dry run to report feature ${fid}:\n${p.stdout}`,
    )

    new Shell(`${apollo} feature delete ${P} -i ${fid}`)
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t EDEN`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected deleted feature not to be found, got:\n${p.stdout}`,
    )

    p = new Shell(`${apollo} feature delete ${P} -i ${fid}`, false)
    assert.strictEqual(
      p.returncode,
      1,
      `Expected deleting already-deleted feature to exit with 1, got ${p.returncode}`,
    )
    assert.ok(
      p.stderr.includes('The following featureId was not found in database'),
      `Expected "featureId was not found" error:\n${p.stderr}`,
    )

    p = new Shell(`${apollo} feature delete ${P} --force -i ${fid}`)
    assert.strictEqual(
      p.returncode,
      0,
      `Expected deleting already-deleted feature with --force to succeed, got ${p.returncode}`,
    )
  })

  void globalThis.itName('Add features', () => {
    let p = new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta.gz -a tiny -f`,
    )
    let out = JSON.parse(p.stdout)
    const assemblyId = out._id
    p = new Shell(`${apollo} feature get ${P} -a tiny`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected new assembly to have no features, got:\n${p.stdout}`,
    )
    // Can add a feature using flags
    p = new Shell(
      `${apollo} feature add ${P} -a tiny -r ctgA -s 1 -e 10 -t remark`,
    )
    JSON.parse(p.stdout)
    p = new Shell(`${apollo} feature get ${P} -a tiny`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 feature after adding with flags, got ${out.length}`,
    )
    const refSeqId = out[0].refSeq
    // Can add a feature using assembly and refSeq ids
    new Shell(
      `${apollo} feature add ${P} -a ${assemblyId} -r ${refSeqId} -s 11 -e 20 -t remark`,
    )
    p = new Shell(`${apollo} feature get ${P} -a ${assemblyId}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 features after adding with assembly and refSeq ids, got ${out.length}`,
    )
    // Can add a feature using JSON arg
    new Shell(
      `${apollo} feature add ${P} '{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":21,"max":30,"type":"remark"}'`,
    )
    p = new Shell(`${apollo} feature get ${P} -a ${assemblyId}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      3,
      `Expected 3 features after adding from JSON arg, got ${out.length}`,
    )
    // Can add a feature using JSON from stdin
    new Shell(
      `${apollo} feature add ${P} <<EOF
{
  "assembly": "${assemblyId}",
  "refSeq": "${refSeqId}",
  "min": 31,
  "max": 40,
  "type": "remark"
}
EOF`,
    )
    p = new Shell(`${apollo} feature get ${P} -a ${assemblyId}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      4,
      `Expected 4 features after adding from stdin JSON, got ${out.length}`,
    )
    // Can add a feature using JSON from a file
    fs.writeFileSync(
      'test_data/tmp.json',
      `{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":41,"max":50,"type":"remark"}\n`,
    )
    new Shell(
      `${apollo} feature add ${P} --feature-json-file test_data/tmp.json`,
    )
    fs.unlinkSync('test_data/tmp.json')
    p = new Shell(`${apollo} feature get ${P} -a ${assemblyId}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      5,
      `Expected 5 features after adding from JSON file, got ${out.length}`,
    )
    // Can add multiple features using JSON
    new Shell(
      `${apollo} feature add ${P} '[{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":51,"max":60,"type":"remark"},{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":61,"max":70,"type":"remark"}]'`,
    )
    p = new Shell(`${apollo} feature get ${P} -a ${assemblyId}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      7,
      `Expected 7 features after adding 2 from JSON array, got ${out.length}`,
    )
    // Can add a feature with children from JSON
    new Shell(
      `${apollo} feature add ${P} '{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":71,"max":80,"type":"match","children":[{"min":71,"max":75,"type":"match_part"}]}'`,
    )
    p = new Shell(
      `${apollo} feature get ${P} -a ${assemblyId} -r ${refSeqId} -s 71 -e 80`,
    )
    out = JSON.parse(p.stdout)
    let feature = out.at(0)
    assert.strictEqual(
      Object.keys(feature?.children).length,
      1,
      `Expected added feature to have 1 child, got ${Object.keys(feature?.children).length}`,
    )
    // Can add a feature with attributes from JSON
    new Shell(
      `${apollo} feature add ${P} '{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":81,"max":90,"type":"remark","attributes":{"key1":["val1"]}}'`,
    )
    p = new Shell(
      `${apollo} feature get ${P} -a ${assemblyId} -r ${refSeqId} -s 81 -e 90`,
    )
    out = JSON.parse(p.stdout)
    feature = out.at(0)
    assert.strictEqual(
      feature?.attributes?.key1?.[0],
      'val1',
      `Expected added feature attribute key1=val1, got ${JSON.stringify(feature?.attributes)}`,
    )
    // Can add a feature with children from JSON
    new Shell(
      `${apollo} feature add ${P} '{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":91,"max":100,"type":"match","children":[{"min":91,"max":95,"type":"match_part","attributes":{"key2":["val2"]}}]}'`,
    )
    p = new Shell(
      `${apollo} feature get ${P} -a ${assemblyId} -r ${refSeqId} -s 91 -e 100`,
    )
    out = JSON.parse(p.stdout)
    feature = out.at(0)
    const keys = Object.keys(feature?.children)
    assert.strictEqual(
      keys.length,
      1,
      `Expected added feature to have 1 child, got ${keys.length}`,
    )
    assert.strictEqual(
      feature.children[keys[0]].attributes.key2[0],
      'val2',
      `Expected child attribute key2=val2, got ${JSON.stringify(feature.children[keys[0]].attributes)}`,
    )
  })

  void globalThis.itName('Add child features', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    let p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    const fid = JSON.parse(p.stdout).at(0)._id

    new Shell(
      `${apollo} feature add-child ${P} -i ${fid} -s 10 -e 20 -t contig_read`,
    )
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig_read`)
    assert.ok(
      p.stdout.includes('contig_read'),
      'Expected added child of type contig_read to be found',
    )
    assert.ok(
      p.stdout.includes('"min": 9'),
      `Expected added child to have 0-based min of 9:\n${p.stdout}`,
    )
    assert.ok(
      p.stdout.includes('"max": 20'),
      `Expected added child to have max of 20:\n${p.stdout}`,
    )

    p = new Shell(
      `${apollo} feature add-child ${P} -i ${fid} -s 10 -e 2000 -t contig_read`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected adding child beyond parent bounds to fail',
    )
    assert.ok(
      p.stderr.includes('Child feature coordinates'),
      `Expected "Child feature coordinates" error:\n${p.stderr}`,
    )

    // Should this fail?
    p = new Shell(
      `${apollo} feature add-child ${P} -i ${fid} -s 10 -e 20 -t FOOBAR`,
      false,
    )
    assert.strictEqual(
      p.returncode,
      0,
      `Expected adding child with unknown type to succeed, got ${p.returncode}:\n${p.stderr}`,
    )
  })

  void globalThis.itName('Import features', () => {
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv1 -e -f`,
    )
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 contigs after first import, got ${out.length}`,
    )

    // Import again: Add to existing feature
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      4,
      `Expected 4 contigs after importing again, got ${out.length}`,
    )

    // Import again: delete ${P} existing
    new Shell(
      `${apollo} feature import ${P} -d test_data/tiny.fasta.gff3 -a vv1`,
    )
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 contigs after importing with -d, got ${out.length}`,
    )

    new Shell(`${apollo} assembly delete ${P} -a vv2`)
    p = new Shell(
      `${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv2`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected importing into non-existent assembly to fail',
    )
    assert.ok(
      p.stderr.includes('Assembly "vv2" does not exist'),
      `Expected "Assembly does not exist" error:\n${p.stderr}`,
    )

    p = new Shell(`${apollo} feature import ${P} foo.gff3 -a vv1`, false)
    assert.ok(p.returncode != 0, 'Expected importing non-existent file to fail')
    assert.ok(
      p.stderr.includes('File "foo.gff3" does not exist'),
      `Expected "File does not exist" error:\n${p.stderr}`,
    )
  })

  void globalThis.itName('Copy feature', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a source -f`,
    )
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a dest -e -f`,
    )
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a dest2 -e -f`,
    )
    let p = new Shell(`${apollo} feature search ${P} -a source -t contig`)
    const fid = JSON.parse(p.stdout).at(0)._id

    new Shell(`${apollo} feature copy ${P} -i ${fid} -r ctgA -a dest -s 1`)
    p = new Shell(`${apollo} feature search ${P} -a dest -t contig`)
    let out = JSON.parse(p.stdout).at(0)
    assert.strictEqual(
      out.min,
      0,
      `Expected copied feature min of 0, got ${out.min}`,
    )
    assert.strictEqual(
      out.max,
      50,
      `Expected copied feature max of 50, got ${out.max}`,
    )

    // RefSeq id does not need assembly
    p = new Shell(`${apollo} refseq get ${P} -a dest2`)
    const destRefSeq = JSON.parse(p.stdout).find(
      (x: any) => x.name === 'ctgA',
    )._id

    new Shell(`${apollo} feature copy ${P} -i ${fid} -r ${destRefSeq} -s 2`)
    p = new Shell(`${apollo} feature search ${P} -a dest2 -t contig`)
    out = JSON.parse(p.stdout).at(0)
    assert.strictEqual(
      out.min,
      1,
      `Expected feature copied by refseq id to have min of 1, got ${out.min}`,
    )
    assert.strictEqual(
      out.max,
      51,
      `Expected feature copied by refseq id to have max of 51, got ${out.max}`,
    )

    // Copy to same assembly
    new Shell(`${apollo} feature copy ${P} -i ${fid} -r ctgA -a source -s 10`)
    p = new Shell(`${apollo} feature search ${P} -a source -t contig`)
    JSON.parse(p.stdout)

    // Copy non-existant feature or refseq
    p = new Shell(
      `${apollo} feature copy ${P} -i FOOBAR -r ctgA -a dest -s 1`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected copying non-existent feature to fail',
    )
    assert.ok(
      p.stderr.includes('featureId was not found'),
      `Expected "featureId was not found" error:\n${p.stderr}`,
    )

    p = new Shell(
      `${apollo} feature copy ${P} -i ${fid} -r FOOBAR -a dest -s 1`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected copying to non-existent refseq to fail',
    )
    assert.ok(
      p.stderr.includes('No reference'),
      `Expected "No reference" error:\n${p.stderr}`,
    )

    // Ambiguous refseq
    p = new Shell(`${apollo} feature copy ${P} -i ${fid} -r ctgA -s 1`, false)
    assert.ok(p.returncode != 0, 'Expected copying to ambiguous refseq to fail')
    assert.ok(
      p.stderr.includes('more than one'),
      `Expected ambiguous refseq error:\n${p.stderr}`,
    )
  })

  void globalThis.itName('Get changes', () => {
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a myAssembly -e -f`,
    )
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a yourAssembly -e -f`,
    )
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a ourAssembly -e -f`,
    )

    let p = new Shell(`${apollo} change get ${P}`)
    JSON.parse(p.stdout)
    assert.ok(
      p.stdout.includes('myAssembly'),
      'Expected changes to include myAssembly',
    )
    assert.ok(
      p.stdout.includes('yourAssembly'),
      'Expected changes to include yourAssembly',
    )

    p = new Shell(`${apollo} change get ${P} -a myAssembly ourAssembly`)
    assert.ok(
      p.stdout.includes('myAssembly'),
      'Expected filtered changes to include myAssembly',
    )
    assert.ok(
      p.stdout.includes('ourAssembly'),
      'Expected filtered changes to include ourAssembly',
    )
    assert.ok(
      p.stdout.includes('yourAssembly') == false,
      'Expected filtered changes not to include yourAssembly',
    )

    // Delete assemblies and get changes by assembly name: Nothing is
    // returned because the assemblies collection doesn't contain that name
    // anymore. Ideally you should still be able to get changes by name?
    new Shell(
      `${apollo} assembly delete ${P} -a myAssembly yourAssembly ourAssembly`,
    )
    p = new Shell(`${apollo} change get ${P} -a myAssembly`)
    const out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      0,
      `Expected no changes for deleted assembly name, got ${out.length}`,
    )
  })

  void globalThis.itName('Get sequence', () => {
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a v1 -e -f`,
    )
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a v2 -e -f`,
    )

    let p = new Shell(`${apollo} assembly sequence ${P} -a nonExistant`, false)
    assert.ok(
      p.returncode != 0,
      'Expected getting sequence of non-existent assembly to fail',
    )
    assert.ok(
      p.stderr.includes('returned 0 assemblies'),
      `Expected "returned 0 assemblies" error:\n${p.stderr}`,
    )

    p = new Shell(`${apollo} assembly sequence ${P} -a v1 -s 0`, false)
    assert.ok(p.returncode != 0, 'Expected start of 0 to fail')
    assert.match(
      p.stderr,
      /must be greater than 0/,
      `Expected "must be greater than 0" error:\n${p.stderr}`,
    )

    p = new Shell(`${apollo} assembly sequence ${P} -a v1`)
    let seq = p.stdout.split(' ')
    assert.strictEqual(
      seq.length,
      25,
      `Expected 25 whitespace-separated sequence tokens, got ${seq.length}`,
    )
    assert.deepStrictEqual(
      seq.at(0),
      '>ctgA:1..420',
      `Unexpected first header: ${seq.at(0)}`,
    )
    assert.deepStrictEqual(
      seq.at(1),
      'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcct',
      `Unexpected first ctgA sequence line: ${seq.at(1)}`,
    )
    assert.deepStrictEqual(
      seq.at(6),
      'ttggtcgctccgttgtaccc',
      `Unexpected last ctgA sequence line: ${seq.at(6)}`,
    )
    assert.deepStrictEqual(
      seq.at(7),
      '>ctgB:1..800',
      `Unexpected second header: ${seq.at(7)}`,
    )
    assert.deepStrictEqual(
      seq.at(-1),
      'ttggtcgctccgttgtaccc',
      `Unexpected last sequence line: ${seq.at(-1)}`,
    )

    p = new Shell(`${apollo} assembly sequence ${P} -a v1 -r ctgB -s 1 -e 1`)
    seq = p.stdout.split(' ')
    assert.deepStrictEqual(
      seq.at(0),
      '>ctgB:1..1',
      `Unexpected header for ctgB:1..1: ${seq.at(0)}`,
    )
    assert.deepStrictEqual(
      seq.at(1),
      'A',
      `Unexpected sequence for ctgB:1..1: ${seq.at(1)}`,
    )

    p = new Shell(`${apollo} assembly sequence ${P} -a v1 -r ctgB -s 2 -e 4`)
    seq = p.stdout.split(' ')
    assert.deepStrictEqual(
      seq.at(0),
      '>ctgB:2..4',
      `Unexpected header for ctgB:2..4: ${seq.at(0)}`,
    )
    assert.deepStrictEqual(
      seq.at(1),
      'CAT',
      `Unexpected sequence for ctgB:2..4: ${seq.at(1)}`,
    )

    p = new Shell(`${apollo} assembly sequence ${P} -r ctgB`, false)
    assert.ok(
      p.returncode != 0,
      'Expected getting sequence of ambiguous refseq to fail',
    )
    assert.ok(
      p.stderr.includes('found in more than one'),
      `Expected ambiguous refseq error:\n${p.stderr}`,
    )
  })

  void globalThis.itName('Get feature by id', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v1 -f`,
    )
    let p = new Shell(`${apollo} feature get ${P} -a v1`)
    const ff = JSON.parse(p.stdout)

    const x1 = ff.at(0)._id
    const x2 = ff.at(1)._id
    p = new Shell(`${apollo} feature get-id ${P} -i ${x1} ${x1} ${x2}`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 features (duplicates ignored), got ${out.length}`,
    )
    assert.deepStrictEqual(
      out.at(0)._id,
      x1,
      `Expected first feature id ${x1}, got ${out.at(0)._id}`,
    )
    assert.deepStrictEqual(
      out.at(1)._id,
      x2,
      `Expected second feature id ${x2}, got ${out.at(1)._id}`,
    )

    p = new Shell(`${apollo} feature get-id ${P} -i FOOBAR`)
    assert.deepStrictEqual(
      p.stdout.trim(),
      '[]',
      `Expected no features for non-existent id, got:\n${p.stdout}`,
    )

    p = new Shell(`echo -e '${x1} \n ${x2}' | ${apollo} feature get-id ${P}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 features from ids on stdin, got ${out.length}`,
    )
  })

  void globalThis.itName('Assembly checks', () => {
    // TODO: Improve tests once more checks exist (currently there is only
    // CDSCheck)
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v1 -f`,
    )

    // Test view available check type
    let p = new Shell(`${apollo} assembly check ${P}`)
    let out = JSON.parse(p.stdout)
    assert.ok(
      p.stdout.includes('CDSCheck'),
      `Expected available checks to include CDSCheck:\n${p.stdout}`,
    )
    assert.ok(
      p.stdout.includes('TranscriptCheck'),
      `Expected available checks to include TranscriptCheck:\n${p.stdout}`,
    )
    const cdsCheckId = out.find((x: any) => x.name === 'CDSCheck')._id

    // Test view checks set for assembly
    p = new Shell(`${apollo} assembly check ${P} -a v1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 checks set for v1 by default, got ${out.length}`,
    )

    // Test non-existant assembly
    p = new Shell(`${apollo} assembly check ${P} -a non-existant`, false)
    assert.strictEqual(
      p.returncode,
      1,
      `Expected non-existent assembly to exit with 1, got ${p.returncode}`,
    )
    assert.ok(
      p.stderr.includes('non-existant'),
      `Expected error to name the non-existent assembly:\n${p.stderr}`,
    )

    // Test non-existant check
    p = new Shell(`${apollo} assembly check ${P} -a v1 -c not-a-check`, false)
    assert.strictEqual(
      p.returncode,
      1,
      `Expected non-existent check to exit with 1, got ${p.returncode}`,
    )
    assert.ok(
      p.stderr.includes('not-a-check'),
      `Expected error to name the non-existent check:\n${p.stderr}`,
    )

    // Test add checks. Test check is added as opposed to replacing current
    // checks with input list
    new Shell(`${apollo} assembly check ${P} -a v1 -c CDSCheck CDSCheck`)
    p = new Shell(`${apollo} assembly check ${P} -a v1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected re-adding CDSCheck to keep 2 checks, got ${out.length}`,
    )
    assert.deepStrictEqual(
      out.at(0).name,
      'CDSCheck',
      `Expected first check to be CDSCheck, got ${out.at(0).name}`,
    )

    // Works also with check id
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v2 -f`,
    )
    new Shell(`${apollo} assembly check ${P} -a v2 -c ${cdsCheckId}`)
    p = new Shell(`${apollo} assembly check ${P} -a v2`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected adding CDSCheck by id to keep 2 checks, got ${out.length}`,
    )
    assert.deepStrictEqual(
      out.at(0).name,
      'CDSCheck',
      `Expected first check to be CDSCheck, got ${out.at(0).name}`,
    )

    // Delete check
    new Shell(`${apollo} assembly check ${P} -a v1 -d -c CDSCheck`)
    p = new Shell(`${apollo} assembly check ${P} -a v1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 check after deleting CDSCheck, got ${out.length}`,
    )
    assert.ok(
      !p.stdout.includes('CDSCheck'),
      `Expected CDSCheck to be deleted:\n${p.stdout}`,
    )
    assert.ok(
      p.stdout.includes('TranscriptCheck'),
      `Expected TranscriptCheck to remain:\n${p.stdout}`,
    )
  })

  void globalThis.itName('Feature checks', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v1 -f`,
    )
    new Shell(`${apollo} assembly check ${P} -a v1 -c CDSCheck`)
    let p = new Shell(`${apollo} feature check ${P} -a v1`)
    const out = JSON.parse(p.stdout)
    assert.ok(
      out.length > 1,
      `Expected more than 1 check result, got ${out.length}`,
    )
    assert.ok(
      p.stdout.includes('InternalStopCodon'),
      'Expected an InternalStopCodon check result',
    )

    // Ids with checks
    const ids: string[] = out.map((x: any) => x.ids)
    assert.ok(
      new Set(ids).size > 1,
      `Expected check results on more than 1 feature, got ${new Set(ids).size}`,
    )

    // Retrieve by feature id
    const xid = [...ids].join(' ')
    p = new Shell(`${apollo} feature check ${P} -i ${xid}`)
    assert.ok(
      p.stdout.includes('InternalStopCodon'),
      'Expected an InternalStopCodon check result when querying by feature id',
    )
  })

  void globalThis.itName('Feature checks indexed', () => {
    new Shell(
      `${apollo} assembly add-from-fasta ${P} -a v1 test_data/tiny.fasta.gz -f`,
    )
    new Shell(`${apollo} assembly check ${P} -a v1 -c CDSCheck`)
    new Shell(
      `${apollo} feature import ${P} -a v1 test_data/tiny.fasta.gff3 -d`,
    )
    let p = new Shell(`${apollo} feature check ${P} -a v1`)
    const out = JSON.parse(p.stdout)
    assert.ok(
      out.length > 1,
      `Expected more than 1 check result, got ${out.length}`,
    )
    assert.ok(
      p.stdout.includes('InternalStopCodon'),
      'Expected an InternalStopCodon check result',
    )

    // Ids with checks
    const ids: string[] = out.map((x: any) => x.ids)
    assert.ok(
      new Set(ids).size > 1,
      `Expected check results on more than 1 feature, got ${new Set(ids).size}`,
    )

    // Retrieve by feature id
    const xid = [...ids].join(' ')
    p = new Shell(`${apollo} feature check ${P} -i ${xid}`)
    assert.ok(
      p.stdout.includes('InternalStopCodon'),
      'Expected an InternalStopCodon check result when querying by feature id',
    )
  })

  void globalThis.itName(
    'Delete check results when unregistering a check',
    () => {
      new Shell(
        `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v1 -f`,
      )
      let p = new Shell(`${apollo} feature check ${P} -a v1`)
      let checkResults = JSON.parse(p.stdout) as CheckResultSnapshot[]
      assert.ok(
        checkResults.length > 1,
        `Expected more than 1 check result initially, got ${checkResults.length}`,
      )

      // Delete all checks and consequently delete all check results
      p = new Shell(`${apollo} assembly check ${P} -a v1`)
      const checkNames = (JSON.parse(p.stdout) as CheckResultSnapshot[]).map(
        (x) => x.name,
      )
      new Shell(
        `${apollo} assembly check ${P} -a v1 -d -c ${checkNames.join(' ')}`,
      )
      p = new Shell(`${apollo} feature check ${P} -a v1`)
      checkResults = JSON.parse(p.stdout)
      assert.deepEqual(
        checkResults.length,
        0,
        `Expected no check results after deleting all checks, got ${checkResults.length}`,
      )

      // Put one check back
      new Shell(`${apollo} assembly check ${P} -a v1 -c CDSCheck`)
      p = new Shell(`${apollo} feature check ${P} -a v1`)
      checkResults = JSON.parse(p.stdout)
      assert.ok(
        checkResults.length > 0,
        'Expected check results after re-adding CDSCheck',
      )
      assert.deepEqual(
        checkResults.filter((x) => x.name === 'CDSCheck').length,
        checkResults.length,
        `Expected all check results to be from CDSCheck:\n${p.stdout}`,
      )
    },
  )

  void globalThis.itName('User', () => {
    let p = new Shell(`${apollo} user get ${P}`)
    let out = JSON.parse(p.stdout)
    assert.ok(out.length > 0, 'Expected at least one user')

    p = new Shell(`${apollo} user get ${P} -r admin`)
    const out2 = JSON.parse(p.stdout)
    assert.ok(out2.length > 0, 'Expected at least one admin user')
    // The test server's guest user is readOnly, so not all users are admins
    assert.ok(
      out.length > out2.length,
      `Expected fewer admin users (${out2.length}) than total users (${out.length})`,
    )

    p = new Shell(`${apollo} user get ${P} -r admin -u root`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected root to be the only admin named root, got ${out.length}`,
    )

    p = new Shell(`${apollo} user get ${P} -r readOnly -u root`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      0,
      `Expected no readOnly users named root, got ${out.length}`,
    )
  })

  void globalThis.itName('Apollo profile env', () => {
    const p = new Shell(
      `export APOLLO_PROFILE=testAdmin2
          ${apollo} config address http://localhost:3999
          ${apollo} config accessType root
          ${apollo} config rootPassword pass
          ${apollo} login -f
          ${apollo} status
          ${apollo} user get`,
    )
    assert.ok(
      p.stdout.includes('testAdmin2: Logged in'),
      `Expected APOLLO_PROFILE profile to be logged in:\n${p.stdout}`,
    )
    assert.ok(
      p.stdout.includes('createdAt'),
      'Expected user get with APOLLO_PROFILE to return users',
    )
  })

  void globalThis.itName('Apollo config create env', () => {
    let p = new Shell(
      `\
            export APOLLO_DISABLE_CONFIG_CREATE=1
            rm -f tmp.yml
            ${apollo} config --config-file tmp.yml address http://localhost:3999`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected config to fail with APOLLO_DISABLE_CONFIG_CREATE=1',
    )
    assert.ok(
      p.stderr.includes('does not exist yet'),
      `Expected "does not exist yet" error:\n${p.stderr}`,
    )
    assert.ok(
      !fs.existsSync('tmp.yml'),
      'Expected config file not to be created with APOLLO_DISABLE_CONFIG_CREATE=1',
    )

    p = new Shell(
      `\
            export APOLLO_DISABLE_CONFIG_CREATE=0
            rm -f tmp.yml
            ${apollo} config --config-file tmp.yml address http://localhost:3999`,
    )
    assert.strictEqual(
      0,
      p.returncode,
      `Expected config to succeed with APOLLO_DISABLE_CONFIG_CREATE=0, got ${p.returncode}`,
    )
    assert.ok(
      fs.existsSync('tmp.yml'),
      'Expected config file to be created with APOLLO_DISABLE_CONFIG_CREATE=0',
    )

    p = new Shell(
      `\
            unset APOLLO_DISABLE_CONFIG_CREATE
            rm -f tmp.yml
            ${apollo} config --config-file tmp.yml address http://localhost:3999`,
    )
    assert.strictEqual(
      0,
      p.returncode,
      `Expected config to succeed with APOLLO_DISABLE_CONFIG_CREATE unset, got ${p.returncode}`,
    )
    assert.ok(
      fs.existsSync('tmp.yml'),
      'Expected config file to be created with APOLLO_DISABLE_CONFIG_CREATE unset',
    )

    fs.unlinkSync('tmp.yml')
  })

  void globalThis.itName('Invalid access', () => {
    const p = new Shell(`${apollo} user get --profile foo`, false)
    assert.strictEqual(
      1,
      p.returncode,
      `Expected non-existent profile to exit with 1, got ${p.returncode}`,
    )
    assert.ok(
      p.stderr.includes('Profile "foo" does not exist'),
      `Expected "Profile does not exist" error:\n${p.stderr}`,
    )
  })

  void globalThis.itName('Refname alias configuration', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a asm1 -f`,
    )

    let p = new Shell(`${apollo} assembly get ${P} -a asm1`)
    assert.ok(
      p.stdout.includes('asm1'),
      'Expected assembly asm1 to be returned',
    )
    assert.ok(
      p.stdout.includes('asm2') == false,
      'Expected only assembly asm1 to be returned',
    )
    const asm_id = JSON.parse(p.stdout)[0]._id

    p = new Shell(
      `${apollo} refseq add-alias ${P} test_data/alias.txt -a asm2`,
      false,
    )
    assert.ok(
      p.stderr.includes('Assembly asm2 not found'),
      `Expected "Assembly asm2 not found" error:\n${p.stderr}`,
    )

    p = new Shell(
      `${apollo} refseq add-alias ${P} test_data/alias.txt -a asm1`,
      false,
    )
    assert.ok(
      p.stdout.includes(
        'Reference name aliases added successfully to assembly asm1',
      ),
      `Expected aliases to be added successfully. Stdout:\n${p.stdout}\nStderr:\n${p.stderr}`,
    )

    p = new Shell(`${apollo} refseq get ${P}`)
    const refseq = JSON.parse(p.stdout.trim())
    const vv1ref = refseq.filter((x: any) => x.assembly === asm_id)
    const refname_aliases: Record<string, string[]> = {}
    for (const x of vv1ref) {
      refname_aliases[x.name] = x.aliases
    }
    assert.deepStrictEqual(
      JSON.stringify(refname_aliases.ctgA.sort()),
      JSON.stringify(['ctga', 'CTGA'].sort()),
      `Unexpected aliases for ctgA: ${JSON.stringify(refname_aliases.ctgA)}`,
    )
    assert.deepStrictEqual(
      JSON.stringify(refname_aliases.ctgB.sort()),
      JSON.stringify(['ctgb', 'CTGB'].sort()),
      `Unexpected aliases for ctgB: ${JSON.stringify(refname_aliases.ctgB)}`,
    )
    assert.deepStrictEqual(
      JSON.stringify(refname_aliases.ctgC.sort()),
      JSON.stringify(['ctgc', 'CTGC'].sort()),
      `Unexpected aliases for ctgC: ${JSON.stringify(refname_aliases.ctgC)}`,
    )
  })

  // Works locally but fails on github
  void globalThis.itName('Login', () => {
    // This should wait for user's input
    const p = new Shell(`${apollo} login ${P}`, false, 5000)
    assert.ok(
      p.returncode != 0,
      'Expected login without --force to wait for input and time out',
    )
    // This should be ok
    new Shell(`${apollo} login ${P} --force`, true, 5000)
  })

  void globalThis.itName('File upload', () => {
    let p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    let out = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      out.type,
      'text/x-fasta',
      `Expected fasta upload type text/x-fasta, got ${out.type}`,
    )
    assert.ok(out._id, 'Expected uploaded file to have an _id')

    p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      out.type,
      'text/x-fasta',
      `Expected re-uploaded fasta type text/x-fasta, got ${out.type}`,
    )

    p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta.gff3`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      out.type,
      'text/x-gff3',
      `Expected gff3 upload type text/x-gff3, got ${out.type}`,
    )

    p = new Shell(`${apollo} file upload ${P} test_data/guest.yaml`, false)
    assert.ok(
      p.returncode != 0,
      'Expected uploading unsupported file type to fail',
    )

    p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta.gz`, false)
    assert.ok(
      p.stderr.includes('it may be gzip or bgzip compressed'),
      `Expected compressed file type detection error:\n${p.stderr}`,
    )
    assert.ok(
      p.returncode != 0,
      'Expected uploading gzip file without type to fail',
    )
  })

  void globalThis.itName('File upload gzip', () => {
    // Uploading a gzip file must skip compression and just copy the file
    const gz = fs.readFileSync('test_data/tiny.fasta.gz')
    const md5 = crypto.createHash('md5').update(gz).digest('hex')

    const p = new Shell(
      `${apollo} file upload ${P} test_data/tiny.fasta.gz -t text/x-fasta`,
    )
    const out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.checksum,
      md5,
      `Expected gzip file to be uploaded unchanged (md5 ${md5}), got checksum ${out.checksum}`,
    )
    new Shell(`${apollo} assembly add-from-fasta ${P} -e -f ${out._id}`)
  })

  void globalThis.itName('Add assembly gzip', () => {
    // Autodetect format
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta.gz -e -f -a vv1`,
    )
    let p = new Shell(`${apollo} assembly sequence ${P} -a vv1`)
    assert.ok(
      p.stdout.startsWith('>'),
      'Expected sequence output to start with a fasta header',
    )
    assert.ok(
      p.stdout.includes('cattgttgcggagttgaaca'),
      'Expected sequence output to include ctgA sequence',
    )

    // Skip autodetect
    fs.copyFileSync('test_data/tiny.fasta', 'test_data/tmp.gz')
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tmp.gz -e -f -a vv1 --decompressed`,
    )
    p = new Shell(`${apollo} assembly sequence ${P} -a vv1`)
    assert.ok(
      p.stdout.startsWith('>'),
      'Expected sequence output to start with a fasta header (--decompressed)',
    )
    assert.ok(
      p.stdout.includes('cattgttgcggagttgaaca'),
      'Expected sequence output to include ctgA sequence (--decompressed)',
    )
    fs.unlinkSync('test_data/tmp.gz')

    fs.copyFileSync('test_data/tiny.fasta.gz', 'test_data/fasta.tmp')
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/fasta.tmp -e -f -a vv1 --gzip`,
    )
    p = new Shell(`${apollo} assembly sequence ${P} -a vv1`)
    assert.ok(
      p.stdout.startsWith('>'),
      'Expected sequence output to start with a fasta header (--gzip)',
    )
    assert.ok(
      p.stdout.includes('cattgttgcggagttgaaca'),
      'Expected sequence output to include ctgA sequence (--gzip)',
    )

    // Autodetect false positive
    p = new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/fasta.tmp -e -f -a vv1`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected gzip file without .gz extension to fail without --gzip',
    )
    fs.unlinkSync('test_data/fasta.tmp')
  })

  void globalThis.itName('Add editable assembly', () => {
    // It would be good to check that really there was no sequence loading
    new Shell(
      `${apollo} assembly add-from-fasta ${P} -f test_data/tiny.fasta.gz`,
    )
    let p = new Shell(`${apollo} assembly sequence ${P} -a tiny.fasta.gz`)
    assert.ok(
      p.stdout.startsWith('>'),
      'Expected sequence output to start with a fasta header',
    )
    assert.ok(
      p.stdout.includes('cattgttgcggagttgaaca'),
      'Expected sequence output to include ctgA sequence',
    )

    p = new Shell(
      `${apollo} assembly add-from-fasta ${P} -f test_data/tiny.fasta`,
      false,
    )
    assert.ok(
      p.returncode != 0,
      'Expected adding uncompressed fasta without -e to fail',
    )
    assert.ok(
      p.stderr.includes('unless option -e/--editable is set'),
      `Expected "-e/--editable" error:\n${p.stderr}`,
    )

    // Setting --gzi & --fai
    new Shell(
      `${apollo} assembly add-from-fasta ${P} -f test_data/tiny2.fasta.gz --gzi test_data/tiny.fasta.gz.gzi --fai test_data/tiny.fasta.gz.fai`,
    )
    p = new Shell(`${apollo} assembly sequence ${P} -a tiny2.fasta.gz`)
    assert.ok(
      p.stdout.startsWith('>'),
      'Expected sequence output to start with a fasta header (--gzi & --fai)',
    )
    assert.ok(
      p.stdout.includes('cattgttgcggagttgaaca'),
      'Expected sequence output to include ctgA sequence (--gzi & --fai)',
    )
  })

  void globalThis.itName('Add assembly from file ids not editable', () => {
    // Upload and get Ids for: bgzip fasta, fai and gzi
    let p = new Shell(
      `${apollo} file upload ${P} test_data/tiny.fasta.gz -t application/x-bgzip-fasta`,
    )
    const fastaId = JSON.parse(p.stdout)._id

    p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta.gz.fai`)
    const faiId = JSON.parse(p.stdout)._id

    p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta.gz.gzi`)
    const gziId = JSON.parse(p.stdout)._id

    new Shell(
      `${apollo} assembly add-from-fasta ${P} -f ${fastaId} --fai test_data/tiny.fasta.gz.fai --gzi test_data/tiny.fasta.gz.gzi`,
    )
    p = new Shell(`${apollo} assembly sequence ${P} -a ${fastaId}`)
    assert.ok(
      p.stdout.startsWith('>'),
      'Expected sequence output to start with a fasta header (local index files)',
    )
    assert.ok(
      p.stdout.includes('cattgttgcggagttgaaca'),
      'Expected sequence output to include ctgA sequence (local index files)',
    )

    new Shell(
      `${apollo} assembly add-from-fasta ${P} -f ${fastaId} --fai ${faiId} --gzi ${gziId}`,
    )
    p = new Shell(`${apollo} assembly sequence ${P} -a ${fastaId}`)
    assert.ok(
      p.stdout.startsWith('>'),
      'Expected sequence output to start with a fasta header (index file ids)',
    )
  })

  void globalThis.itName('Add assembly from file id', () => {
    let p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const fid = JSON.parse(p.stdout)._id
    p = new Shell(`${apollo} assembly add-from-fasta ${P} ${fid} -a up -e -f`)
    const out = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      out.name,
      'up',
      `Expected assembly name "up", got ${out.name}`,
    )
    assert.deepStrictEqual(
      out.fileIds.fa,
      fid,
      `Expected assembly fa file id ${fid}, got ${out.fileIds.fa}`,
    )
  })

  void globalThis.itName('Get files', () => {
    new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    let p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const fid = JSON.parse(p.stdout)._id

    p = new Shell(`${apollo} file get ${P}`)
    let out = JSON.parse(p.stdout)
    assert.ok(out.length >= 2, `Expected at least 2 files, got ${out.length}`)
    assert.ok(
      out.some((x: any) => x._id === fid),
      `Expected file ${fid} to be returned`,
    )

    p = new Shell(`${apollo} file get ${P} -i ${fid} ${fid}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 file (duplicates ignored), got ${out.length}`,
    )

    p = new Shell(`${apollo} file get ${P} -i nonexists`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      0,
      `Expected no files for non-existent id, got ${out.length}`,
    )
  })

  void globalThis.itName('Download file', () => {
    let p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const up = JSON.parse(p.stdout)
    if (fs.existsSync(up.basename)) {
      throw new Error(
        `File ${up.basename} exists - if safe to do so, delete it before running this test`,
      )
    }

    new Shell(`${apollo} file download ${P} -i ${up._id}`)
    let down = fs.readFileSync(up.basename).toString()
    assert.ok(
      down.startsWith('>'),
      'Expected downloaded file to start with a fasta header',
    )
    assert.ok(
      down.trim().endsWith('accc'),
      'Expected downloaded file to end with the last sequence',
    )
    fs.unlinkSync(up.basename)

    new Shell(`${apollo} file download ${P} -i ${up._id} -o tmp.fa`)
    down = fs.readFileSync('tmp.fa').toString()
    assert.ok(
      down.startsWith('>'),
      'Expected file downloaded with -o to start with a fasta header',
    )
    assert.ok(
      down.trim().endsWith('accc'),
      'Expected file downloaded with -o to end with the last sequence',
    )
    fs.unlinkSync('tmp.fa')

    p = new Shell(`${apollo} file download ${P} -i ${up._id} -o -`)
    assert.ok(
      p.stdout.startsWith('>'),
      'Expected file downloaded to stdout to start with a fasta header',
    )
    assert.ok(
      p.stdout.trim().endsWith('accc'),
      'Expected file downloaded to stdout to end with the last sequence',
    )
  })

  void globalThis.itName('Delete file', () => {
    let p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const up1 = JSON.parse(p.stdout)
    p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const up2 = JSON.parse(p.stdout)

    p = new Shell(`${apollo} file delete ${P} -i ${up1._id} ${up2._id}`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      2,
      `Expected 2 deleted files, got ${out.length}`,
    )

    p = new Shell(`${apollo} file get ${P} -i ${up1._id} ${up2._id}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      0,
      `Expected deleted files not to be found, got ${out.length}`,
    )
  })

  void globalThis.itName('Export gff3 from editable assembly', () => {
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta.gz -a vv1 -f --editable`,
    )
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new Shell(`${apollo} export gff3 ${P} vv1 --include-fasta`)
    let gff = p.stdout
    assert.match(
      gff,
      /^##gff-version 3/,
      'Expected GFF3 export to start with ##gff-version 3',
    )
    assert.match(
      gff,
      /multivalue=val1,val2,val3/,
      'Expected GFF3 export to include multi-value attribute',
    )
    assert.match(
      gff,
      /##FASTA/,
      'Expected GFF3 export with --include-fasta to include ##FASTA',
    )
    assert.match(
      gff,
      /taccc$/,
      'Expected GFF3 export with --include-fasta to end with sequence',
    )

    p = new Shell(`${apollo} export gff3 ${P} vv1`)
    gff = p.stdout
    assert.match(
      gff,
      /^##gff-version 3/,
      'Expected GFF3 export to start with ##gff-version 3',
    )
    assert.match(
      gff,
      /multivalue=val1,val2,val3/,
      'Expected GFF3 export to include multi-value attribute',
    )
    assert.doesNotMatch(
      gff,
      /##FASTA/,
      'Expected GFF3 export without --include-fasta not to include ##FASTA',
    )

    // Invalid assembly
    p = new Shell(`${apollo} export gff3 ${P} foobar`, false)
    assert.ok(
      p.returncode != 0,
      'Expected exporting non-existent assembly to fail',
    )
    assert.ok(
      p.stderr.includes('foobar'),
      `Expected error to name the non-existent assembly:\n${p.stderr}`,
    )
  })

  void globalThis.itName('Export gff3 from non-editable assembly', () => {
    new Shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta.gz -a vv1 -f`,
    )
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new Shell(`${apollo} export gff3 ${P} vv1 --include-fasta`)
    let gff = p.stdout
    assert.match(
      gff,
      /^##gff-version 3/,
      'Expected GFF3 export to start with ##gff-version 3',
    )
    assert.match(
      gff,
      /multivalue=val1,val2,val3/,
      'Expected GFF3 export to include multi-value attribute',
    )
    assert.match(
      gff,
      /##FASTA/,
      'Expected GFF3 export with --include-fasta to include ##FASTA',
    )
    assert.match(
      gff,
      /taccc$/,
      'Expected GFF3 export with --include-fasta to end with sequence',
    )

    p = new Shell(`${apollo} export gff3 ${P} vv1`)
    gff = p.stdout
    assert.match(
      gff,
      /^##gff-version 3/,
      'Expected GFF3 export to start with ##gff-version 3',
    )
    assert.match(
      gff,
      /multivalue=val1,val2,val3/,
      'Expected GFF3 export to include multi-value attribute',
    )
    assert.doesNotMatch(
      gff,
      /##FASTA/,
      'Expected GFF3 export without --include-fasta not to include ##FASTA',
    )
  })

  void globalThis.itName('Export gff3 from external assembly', () => {
    new Shell(
      `${apollo} assembly add-from-fasta ${P} http://localhost:3131/tiny.fasta.gz -a vv1 -f`,
    )
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new Shell(`${apollo} export gff3 ${P} vv1 --include-fasta`)
    let gff = p.stdout
    assert.match(
      gff,
      /^##gff-version 3/,
      'Expected GFF3 export to start with ##gff-version 3',
    )
    assert.match(
      gff,
      /multivalue=val1,val2,val3/,
      'Expected GFF3 export to include multi-value attribute',
    )
    assert.match(
      gff,
      /##FASTA/,
      'Expected GFF3 export with --include-fasta to include ##FASTA',
    )
    assert.match(
      gff,
      /taccc$/,
      'Expected GFF3 export with --include-fasta to end with sequence',
    )

    p = new Shell(`${apollo} export gff3 ${P} vv1`)
    gff = p.stdout
    assert.match(
      gff,
      /^##gff-version 3/,
      'Expected GFF3 export to start with ##gff-version 3',
    )
    assert.match(
      gff,
      /multivalue=val1,val2,val3/,
      'Expected GFF3 export to include multi-value attribute',
    )
    assert.doesNotMatch(
      gff,
      /##FASTA/,
      'Expected GFF3 export without --include-fasta not to include ##FASTA',
    )
  })

  void globalThis.itName(
    'Position of internal stop codon warning in forward',
    () => {
      new Shell(
        `${apollo} assembly add-from-gff ${P} test_data/warningPositionForward.gff -a vv1 -f`,
      )
      deleteAllChecks(apollo, P, 'vv1')
      new Shell(`${apollo} assembly check ${P} -a vv1 -c CDSCheck`)

      const p = new Shell(`${apollo} feature check ${P} -a vv1`)
      const out = JSON.parse(p.stdout)
      assert.deepStrictEqual(
        out.length,
        2,
        `Expected 2 check results, got ${out.length}`,
      )

      assert.deepStrictEqual(
        out.at(0).cause,
        'InternalStopCodon',
        `Expected first check cause InternalStopCodon, got ${out.at(0).cause}`,
      )
      assert.deepStrictEqual(
        out.at(0).start,
        9,
        `Expected first check start 9, got ${out.at(0).start}`,
      )
      assert.deepStrictEqual(
        out.at(0).end,
        15,
        `Expected first check end 15, got ${out.at(0).end}`,
      )

      assert.deepStrictEqual(
        out.at(1).cause,
        'InternalStopCodon',
        `Expected second check cause InternalStopCodon, got ${out.at(1).cause}`,
      )
      assert.deepStrictEqual(
        out.at(1).start,
        21,
        `Expected second check start 21, got ${out.at(1).start}`,
      )
      assert.deepStrictEqual(
        out.at(1).end,
        24,
        `Expected second check end 24, got ${out.at(1).end}`,
      )
    },
  )

  void globalThis.itName(
    'Position of internal stop codon warning in reverse',
    () => {
      new Shell(
        `${apollo} assembly add-from-gff ${P} test_data/warningPositionReverse.gff -a vv1 -f`,
      )
      deleteAllChecks(apollo, P, 'vv1')
      new Shell(`${apollo} assembly check ${P} -a vv1 -c CDSCheck`)
      const p = new Shell(`${apollo} feature check ${P} -a vv1`)
      const out = JSON.parse(p.stdout)
      assert.deepStrictEqual(
        out.length,
        2,
        `Expected 2 check results, got ${out.length}`,
      )
      assert.deepStrictEqual(
        out.at(0).cause,
        'InternalStopCodon',
        `Expected first check cause InternalStopCodon, got ${out.at(0).cause}`,
      )
      assert.deepStrictEqual(
        out.at(0).start,
        3,
        `Expected first check start 3, got ${out.at(0).start}`,
      )
      assert.deepStrictEqual(
        out.at(0).end,
        18,
        `Expected first check end 18, got ${out.at(0).end}`,
      )

      assert.deepStrictEqual(
        out.at(1).cause,
        'InternalStopCodon',
        `Expected second check cause InternalStopCodon, got ${out.at(1).cause}`,
      )
      assert.deepStrictEqual(
        out.at(1).start,
        18,
        `Expected second check start 18, got ${out.at(1).start}`,
      )
      assert.deepStrictEqual(
        out.at(1).end,
        21,
        `Expected second check end 21, got ${out.at(1).end}`,
      )
    },
  )

  void globalThis.itName('Detect missing start codon forward', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/missingStartCodonForward.gff3 -a m1 -f`,
    )
    deleteAllChecks(apollo, P, 'm1')
    new Shell(`${apollo} assembly check ${P} -a m1 -c CDSCheck`)
    const p = new Shell(`${apollo} feature check ${P} -a m1`)
    const out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 check result, got ${out.length}`,
    )
    assert.deepStrictEqual(
      out.at(0).cause,
      'MissingStartCodon',
      `Expected check cause MissingStartCodon, got ${out.at(0).cause}`,
    )
    assert.deepStrictEqual(
      out.at(0).start,
      3,
      `Expected check start 3, got ${out.at(0).start}`,
    )
    assert.deepStrictEqual(
      out.at(0).end,
      3,
      `Expected check end 3, got ${out.at(0).end}`,
    )
    assert.ok(
      out.at(0).message.includes('TTG'),
      `Expected check message to mention codon TTG: ${out.at(0).message}`,
    )
  })

  void globalThis.itName('Detect missing start codon reverse', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/missingStartCodonReverse.gff3 -a m1 -f`,
    )
    deleteAllChecks(apollo, P, 'm1')
    new Shell(`${apollo} assembly check ${P} -a m1 -c CDSCheck`)
    const p = new Shell(`${apollo} feature check ${P} -a m1`)
    const out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      1,
      `Expected 1 check result, got ${out.length}`,
    )
    assert.deepStrictEqual(
      out.at(0).cause,
      'MissingStartCodon',
      `Expected check cause MissingStartCodon, got ${out.at(0).cause}`,
    )
    assert.deepStrictEqual(
      out.at(0).start,
      23,
      `Expected check start 23, got ${out.at(0).start}`,
    )
    assert.deepStrictEqual(
      out.at(0).end,
      23,
      `Expected check end 23, got ${out.at(0).end}`,
    )
    assert.ok(
      out.at(0).message.includes('agC'),
      `Expected check message to mention codon agC: ${out.at(0).message}`,
    )
  })

  void globalThis.itName('Edit exon inferred from CDS', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/cdsWithoutExon.gff3 -f`,
    )
    let p = new Shell(
      `${apollo} feature search ${P} -t mrna01 -a cdsWithoutExon.gff3`,
    )
    let out = JSON.parse(p.stdout)
    const gene: any = out.at(0)
    const mrna: any = Object.values(gene.children).at(0)
    const cdsExon: AnnotationFeature[] = Object.values(mrna.children)
    const exon = cdsExon.filter((x: any) => x.type === 'exon')
    assert.deepStrictEqual(
      exon.length,
      1,
      `Expected 1 exon inferred from CDS, got ${exon.length}`,
    )
    const exon_id = exon[0]._id

    // Before edit
    p = new Shell(`${apollo} feature get-id ${P} -i ${exon_id}`)
    out = JSON.parse(p.stdout) as AnnotationFeature[]
    assert.deepStrictEqual(
      out.at(0)?.max,
      20,
      `Expected inferred exon max of 20 before edit, got ${out.at(0)?.max}`,
    )

    // After edit
    new Shell(`${apollo} feature edit-coords ${P} -i ${exon_id} -e 30`)
    p = new Shell(`${apollo} feature get-id ${P} -i ${exon_id}`)
    out = JSON.parse(p.stdout) as AnnotationFeature[]
    assert.deepStrictEqual(
      out.at(0)?.max,
      30,
      `Expected inferred exon max of 30 after edit, got ${out.at(0)?.max}`,
    )
  })

  void globalThis.itName('Check splice site', () => {
    new Shell(
      `${apollo} assembly add-from-gff ${P} test_data/checkSplice.fasta.gff3 -f`,
    )
    deleteAllChecks(apollo, P, 'checkSplice.fasta.gff3')
    new Shell(
      `${apollo} assembly check ${P} -a checkSplice.fasta.gff3 -c TranscriptCheck`,
    )

    let p = new Shell(`${apollo} feature get ${P} -a checkSplice.fasta.gff3`)
    const features = JSON.parse(p.stdout)

    const okMrnaId = []
    let warnMrnaIdForw
    let warnMrnaIdRev
    for (const x of features) {
      const children: AnnotationFeatureSnapshot[] = Object.values(x.children)
      for (const child of children) {
        if (!child.attributes) {
          throw new Error('Error getting attributes')
        }
        if (
          JSON.stringify(child.attributes.gff_id) ===
            JSON.stringify(['EDEN.1']) ||
          JSON.stringify(child.attributes.gff_id) ===
            JSON.stringify(['EDEN2.1'])
        ) {
          okMrnaId.push(child._id)
        }
        if (
          JSON.stringify(child.attributes.gff_id) === JSON.stringify(['EDEN.2'])
        ) {
          warnMrnaIdForw = child._id
        }
        if (
          JSON.stringify(child.attributes.gff_id) ===
          JSON.stringify(['EDEN2.2'])
        ) {
          warnMrnaIdRev = child._id
        }
      }
    }

    p = new Shell(
      `${apollo} feature check ${P} -a checkSplice.fasta.gff3 -i ${okMrnaId.join(' ')}`,
    )
    let out = JSON.parse(p.stdout)
    assert.deepStrictEqual(
      out,
      [],
      `Expected no splice site warnings for canonical transcripts:\n${p.stdout}`,
    )

    // Check forward transcript
    p = new Shell(
      `${apollo} feature check ${P} -a checkSplice.fasta.gff3 -i ${warnMrnaIdForw}`,
    )
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      4,
      `Expected 4 splice site warnings on forward transcript, got ${out.length}`,
    )
    let chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtFivePrime' && x.start === 11,
    )
    assert.strictEqual(
      chk.length,
      1,
      `Expected 1 forward five-prime warning at 11, got ${chk.length}`,
    )
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtFivePrime' && x.start === 31,
    )
    assert.strictEqual(
      chk.length,
      1,
      `Expected 1 forward five-prime warning at 31, got ${chk.length}`,
    )
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtThreePrime' && x.start === 17,
    )
    assert.strictEqual(
      chk.length,
      1,
      `Expected 1 forward three-prime warning at 17, got ${chk.length}`,
    )
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtThreePrime' && x.start === 37,
    )
    assert.strictEqual(
      chk.length,
      1,
      `Expected 1 forward three-prime warning at 37, got ${chk.length}`,
    )

    // Check reverse transcript
    p = new Shell(
      `${apollo} feature check ${P} -a checkSplice.fasta.gff3 -i ${warnMrnaIdRev}`,
    )
    out = JSON.parse(p.stdout)
    assert.strictEqual(
      out.length,
      4,
      `Expected 4 splice site warnings on reverse transcript, got ${out.length}`,
    )
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtThreePrime' && x.start === 11,
    )
    assert.strictEqual(
      chk.length,
      1,
      `Expected 1 reverse three-prime warning at 11, got ${chk.length}`,
    )
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtThreePrime' && x.start === 31,
    )
    assert.strictEqual(
      chk.length,
      1,
      `Expected 1 reverse three-prime warning at 31, got ${chk.length}`,
    )
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtFivePrime' && x.start === 17,
    )
    assert.strictEqual(
      chk.length,
      1,
      `Expected 1 reverse five-prime warning at 17, got ${chk.length}`,
    )
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtFivePrime' && x.start === 37,
    )
    assert.strictEqual(
      chk.length,
      1,
      `Expected 1 reverse five-prime warning at 37, got ${chk.length}`,
    )
  })

  void globalThis.itName('Timeout option', async () => {
    // Every CLI request to the real server is preceded by two lightweight
    // access-token checks (see BaseCommand.getURL/getHeaders), so only the
    // 3rd request is the one actually governed by --timeout. Delay only
    // that one so the two checks don't slow the test down.
    const serverScript = 'test_data/tmp_timeout_server.mjs'
    fs.writeFileSync(
      serverScript,
      `
import http from 'node:http'
let requestCount = 0
const server = http.createServer((req, res) => {
  requestCount++
  const respond = () => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('[]')
  }
  if (requestCount % 3 === 0) {
    setTimeout(respond, 3000)
  } else {
    respond()
  }
})
server.listen(0, () => {
  console.log(server.address().port)
})
`,
    )
    const server = spawnChildProcess('node', [serverScript])
    const port: string = await new Promise((resolve) => {
      server.stdout.once('data', (data: Buffer) => {
        resolve(data.toString().trim())
      })
    })

    new Shell(
      `${apollo} config --profile fakeTimeout address http://localhost:${port}`,
    )
    new Shell(`${apollo} config --profile fakeTimeout accessToken dummytoken`)

    try {
      // Timeout shorter than the server's response delay: the request
      // should fail with a headers timeout error.
      let p = new Shell(
        `${apollo} assembly get --profile fakeTimeout --timeout 1s`,
        false,
      )
      assert.notStrictEqual(
        p.returncode,
        0,
        'Expected request to fail when timeout is shorter than server delay',
      )
      assert.ok(
        p.stderr.includes('UND_ERR_HEADERS_TIMEOUT'),
        `Expected a headers timeout error:\n${p.stderr}`,
      )

      // Timeout longer than the server's response delay: the request
      // should succeed.
      p = new Shell(
        `${apollo} assembly get --profile fakeTimeout --timeout 10s`,
      )
      assert.strictEqual(
        p.stdout.trim(),
        '[]',
        `Expected request to succeed when timeout is longer than server delay, got:\n${p.stdout}\n${p.stderr}`,
      )
    } finally {
      server.kill()
      fs.unlinkSync(serverScript)
    }
  })
})
