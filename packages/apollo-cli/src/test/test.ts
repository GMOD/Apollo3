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
import { MongoClient, type ObjectId } from 'mongodb'

import { Shell, deleteAllChecks } from './utils.js'

const apollo = process.env.APOLLO_BIN ?? 'yarn dev'
const P = '--profile testAdmin'
// let client = MongoClient
let client: MongoClient
let configFile = ''
let configFileBak = ''
// Assemblies are seeded once, at server startup, from a JBrowse config.json
// (see packages/apollo-collaboration-server/test/data/config.json) - they
// can no longer be created or deleted through the CLI, so tests share this
// fixed pool instead of creating their own. Some tests do mutate an
// assembly's `checks` array, so we snapshot it here and restore it after
// every test to keep tests order-independent.
let assemblyChecksSnapshot: { _id: ObjectId; checks: ObjectId[] }[] = []

void describe('Test CLI', () => {
  before(async () => {
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

    const database = client.db('apolloTestCliDb')
    assemblyChecksSnapshot = (await database
      .collection('assemblies')
      .find({}, { projection: { checks: 1 } })
      .toArray()) as unknown as { _id: ObjectId; checks: ObjectId[] }[]
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
      ['changes', 'checkresults', 'counters', 'features', 'files'].map(
        (collectionName) => database.collection(collectionName).deleteMany({}),
      ),
    )
    // Assemblies/refseqs are seeded once at server startup and not
    // recreated per test, so instead of wiping them, restore whichever
    // assemblies' `checks` a test may have changed.
    await Promise.all(
      assemblyChecksSnapshot.map((assembly) =>
        database
          .collection('assemblies')
          .updateOne(
            { _id: assembly._id },
            { $set: { checks: assembly.checks } },
          ),
      ),
    )
    // Put back starting config file
    fs.renameSync(configFileBak, configFile)
  })

  void globalThis.itName('Print help', () => {
    const p = new Shell(`${apollo} --help`)
    assert.ok(p.stdout.includes('COMMANDS'))
  })

  void globalThis.itName('Get config file', () => {
    const p = new Shell(`${apollo} config --get-config-file`)
    assert.ok(p.stdout.startsWith('/'))
  })

  void globalThis.itName('Config invalid keys', () => {
    let p = new Shell(`${apollo} config ${P} address spam`, false)
    assert.strictEqual(1, p.returncode)
    assert.ok(p.stderr.includes('Invalid setting:'))

    p = new Shell(`${apollo} config ${P} ADDRESS http://localhost:3999`, false)
    assert.strictEqual(1, p.returncode)
    assert.ok(p.stderr.includes('Invalid setting:'))

    p = new Shell(`${apollo} config ${P} accessType spam`, false)
    assert.strictEqual(1, p.returncode)
    assert.ok(p.stderr.includes('Invalid setting:'))
  })

  void globalThis.itName('Can change access type', () => {
    const p = new Shell(`${apollo} config ${P} accessType google`)
    assert.strictEqual('', p.stdout.trim())
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
        assert.ok(stdout.includes('guest'))
      } finally {
        child.kill()
        authServer.kill()
        fs.unlinkSync(serverScript)
      }

      const p = new Shell(`${apollo} config ${P} accessType`)
      assert.strictEqual(p.stdout.trim(), 'guest')
    },
  )

  void globalThis.itName('Apollo status', () => {
    let p = new Shell(`${apollo} status ${P}`)
    assert.strictEqual(p.stdout.trim(), 'testAdmin: Logged in')

    new Shell(`${apollo} logout ${P}`)
    p = new Shell(`${apollo} status ${P}`)
    assert.strictEqual(p.stdout.trim(), 'testAdmin: Logged out')

    new Shell(`${apollo} login ${P} -f`)
  })

  void globalThis.itName('Feature get', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv2`)

    let p = new Shell(`${apollo} feature get ${P} -a vv1`)
    assert.ok(p.stdout.includes('ctgA'))
    assert.ok(p.stdout.includes('SomeContig'))

    p = new Shell(`${apollo} feature get ${P} -r ctgA`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('found in more than one assembly'))

    p = new Shell(`${apollo} feature get ${P} -a vv1 -r ctgA`)
    let out = JSON.parse(p.stdout)
    assert.ok(Object.keys(out.at(0)).length > 2)

    p = new Shell(`${apollo} feature get ${P} -a vv1 -r ctgA -s 40 -e 41`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)

    p = new Shell(`${apollo} feature get ${P} -a vv1 -r ctgA -s 1000 -e 1000`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out, [])

    p = new Shell(`${apollo} feature get ${P} -r FOOBAR`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out, [])

    p = new Shell(`${apollo} feature get ${P} -a FOOBAR -r ctgA`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('returned 0 assemblies'))
  })

  void globalThis.itName('Assembly get', () => {
    let p = new Shell(`${apollo} assembly get ${P}`)
    assert.ok(p.stdout.includes('vv1'))
    assert.ok(p.stdout.includes('vv2'))
    assert.ok(p.stdout.includes('vv3'))

    p = new Shell(`${apollo} assembly get ${P} -a vv1 vv2`)
    assert.ok(p.stdout.includes('vv1'))
    assert.ok(p.stdout.includes('vv2'))
    assert.ok(p.stdout.includes('vv3') == false)

    const out = JSON.parse(p.stdout)
    const aid = out.find((x: any) => x.name === 'vv1')._id
    p = new Shell(`${apollo} assembly get ${P} -a ${aid} vv2`)
    assert.ok(p.stdout.includes('vv1'))
    assert.ok(p.stdout.includes('vv2'))
    assert.ok(p.stdout.includes('vv3') == false)
  })

  void globalThis.itName('Id reader', () => {
    let p = new Shell(`${apollo} assembly get ${P}`)
    const xall = JSON.parse(p.stdout)

    p = new Shell(`${apollo} assembly get ${P} -a vv1 vv2`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    // This is interpreted as an assembly named 'vv1 vv2'
    p = new Shell(`echo vv1 vv2 | ${apollo} assembly get ${P} -a -`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)

    // These are two assemblies
    p = new Shell(`echo -e 'vv1 \n vv2' | ${apollo} assembly get ${P} -a -`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    p = new Shell(
      `${apollo} assembly get ${P} | ${apollo} assembly get ${P} -a -`,
    )
    out = JSON.parse(p.stdout)
    assert.ok(out.length >= 3)

    // From json file
    new Shell(`${apollo} assembly get ${P} > test_data/tmp.json`)
    p = new Shell(`${apollo} assembly get ${P} -a test_data/tmp.json`)
    out = JSON.parse(p.stdout)
    assert.ok(out.length >= 3)
    fs.unlinkSync('test_data/tmp.json')

    // From text file, one name or id per line
    fs.writeFileSync('test_data/tmp.txt', 'vv1 \n vv2 \r\n vv3 \n')
    p = new Shell(`${apollo} assembly get ${P} -a test_data/tmp.txt`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 3)
    fs.unlinkSync('test_data/tmp.txt')

    // From json string
    const aid = xall.at(0)._id
    let j = `{"_id": "${aid}"}`
    p = new Shell(`${apollo} assembly get ${P} -a '${j}'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.strictEqual(out.at(0)._id, aid)

    const id1 = xall.at(0)._id
    const id2 = xall.at(1)._id
    j = `[{"_id": "${id1}"}, {"_id": "${id2}"}]`
    p = new Shell(`${apollo} assembly get ${P} -a '${j}'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    j = `{"XYZ": "${aid}"}`
    p = new Shell(`${apollo} assembly get ${P} -a '${j}'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)

    p = new Shell(`${apollo} assembly get ${P} -a '[...'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)
  })

  void globalThis.itName('Checks are triggered and resolved', () => {
    new Shell(`${apollo} feature import ${P} test_data/checks.gff -a checks`)
    let p = new Shell(`${apollo} feature get ${P} -a checks`)
    const out = JSON.parse(p.stdout)

    p = new Shell(`${apollo} feature check ${P} -a checks`)
    assert.deepStrictEqual(p.stdout.trim(), '[]') // No failing check

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
    p = new Shell(`${apollo} feature check ${P} -a checks`)
    const checks = JSON.parse(p.stdout)
    assert.strictEqual(checks.length, 2)
    assert.ok(p.stdout.includes('InternalStopCodon'))
    assert.ok(p.stdout.includes('MissingStopCodon'))

    // Problems fixed
    new Shell(
      `${apollo} feature edit-coords ${P} -i ${cds_id} --start 16 --end 27`,
    )
    p = new Shell(`${apollo} feature check ${P} -a checks`)
    assert.deepStrictEqual(JSON.parse(p.stdout).length, 0)
  })

  void globalThis.itName('FIXME: Checks stay after invalid operation', () => {
    new Shell(`${apollo} feature import ${P} test_data/checks.gff -a checks`)
    let p = new Shell(`${apollo} feature get ${P} -a checks`)
    const out = JSON.parse(p.stdout)

    p = new Shell(`${apollo} feature check ${P} -a checks`)
    assert.deepStrictEqual(p.stdout.trim(), '[]') // No failing check

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
    p = new Shell(`${apollo} feature check ${P} -a checks`)
    const checks = JSON.parse(p.stdout)
    assert.strictEqual(checks.length, 2)
    assert.ok(p.stdout.includes('InternalStopCodon'))
    assert.ok(p.stdout.includes('MissingStopCodon'))

    // Do something invalid: extend CDS beyond parent
    p = new Shell(
      `${apollo} feature edit-coords ${P} -i ${cds_id} --end 30`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('exceeds the bounds of its parent'))

    // FIXME: Checks should be the same as before the invalid edit
    // p = new Shell(`${apollo} feature check ${P} -a checks`)
    // checks = JSON.parse(p.stdout)
    //assert.strictEqual(checks.length, 2)
    //assert.ok(p.stdout.includes('InternalStopCodon'))
    //assert.ok(p.stdout.includes('MissingStopCodon'))
  })

  void globalThis.itName('Edit feature from json', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new Shell(`${apollo} feature search ${P} -a vv1 -t BAC`)
    let out = JSON.parse(p.stdout).at(0)
    assert.strictEqual(out.type, 'BAC')

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
    assert.strictEqual(out.type, 'G_quartet')
  })

  void globalThis.itName('Edit feature type', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)

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
    assert.ok(features.length > 2)

    // Get id of feature of type contig
    let contig = features.filter((x: any) => x.type === 'contig')
    assert.strictEqual(contig.length, 1)
    const contig_id = contig.at(0)._id

    // Edit type of "contig" feature
    new Shell(`${apollo} feature edit-type ${P} -i ${contig_id} -t region`)

    p = new Shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(._id == "${contig_id}")'`,
    )
    contig = JSON.parse(p.stdout)
    assert.deepStrictEqual(contig.type, 'region')

    // Return current type
    p = new Shell(`${apollo} feature edit-type ${P} -i ${contig_id}`)
    assert.deepStrictEqual(p.stdout.trim(), 'region')
  })

  void globalThis.itName('Edit feature coords', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)

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
    assert.ok(features.length > 2)

    // Get id of feature of type contig
    let contig = features.filter((x: any) => x.type === 'contig')
    assert.strictEqual(contig.length, 1)
    const contig_id = contig.at(0)._id

    // Edit start and end coordinates
    new Shell(`${apollo} feature edit-coords ${P} -i ${contig_id} -s 80 -e 160`)
    new Shell(`${apollo} feature edit-coords ${P} -i ${contig_id} -s 20 -e 100`)

    p = new Shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(._id == "${contig_id}")'`,
    )
    contig = JSON.parse(p.stdout)
    assert.strictEqual(contig.min, 20 - 1)
    assert.strictEqual(contig.max, 100)

    new Shell(`${apollo} feature edit-coords ${P} -i ${contig_id} -s 1 -e 1`)
    p = new Shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(._id == "${contig_id}")'`,
    )
    contig = JSON.parse(p.stdout)
    assert.strictEqual(contig.min, 0)
    assert.strictEqual(contig.max, 1)

    p = new Shell(
      `${apollo} feature edit-coords ${P} -i ${contig_id} -s 0`,
      false,
    )
    assert.strictEqual(p.returncode, 2)
    assert.ok(p.stderr.includes('Coordinates must be greater than 0'))

    p = new Shell(
      `${apollo} feature edit-coords ${P} -i ${contig_id} -s 10 -e 9`,
      false,
    )
    assert.strictEqual(p.returncode, 2)
    assert.ok(
      p.stderr.includes(
        'Error: The new end coordinate is lower than the new start coordinate',
      ),
    )

    // Edit a feature by extending beyond the boundary of its parent and
    // check it throws a meaningful error message
    // let eden_gene = undefined
    const eden_gene = features.find(
      (x: any) => x.type === 'gene' && x.attributes.gff_name.at(0) === 'EDEN',
    )
    assert.ok(eden_gene)
    const mrna_id = Object.keys(eden_gene.children).at(0)
    p = new Shell(
      `${apollo} feature edit-coords ${P} -i ${mrna_id} -s 1`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('exceeds the bounds of its parent'))
  })

  void globalThis.itName('Edit attributes', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)

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
    assert.deepStrictEqual(out.at(0), `Eggs & Stuff`)

    // Add attribute
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -v stuff`,
    )
    p = new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr`)
    assert.ok(p.stdout.includes('stuf'))

    // Non existing attr
    p = new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a NonExist`)
    assert.deepStrictEqual(p.stdout.trim(), '')

    // List of values
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -v A B C`,
    )
    p = new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out, ['A', 'B', 'C'])

    // Delete attribute
    new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -d`)
    p = new Shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr`)
    assert.deepStrictEqual(p.stdout.trim(), '')
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
    assert.deepStrictEqual(out, ['GO:0051728', 'GO:0019090'])

    // This should fail
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a 'Gene Ontology' -v FOOBAR`,
    )
  })

  void globalThis.itName('Search features', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv2`)

    let p = new Shell(`${apollo} feature search ${P} -a vv1 vv2 -t EDEN`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
    assert.ok(p.stdout.includes('EDEN'))

    p = new Shell(`${apollo} feature search ${P} -t EDEN`)
    out = JSON.parse(p.stdout)
    assert.ok(out.length >= 2)

    p = new Shell(`${apollo} feature search ${P} -a vv1 -t EDEN`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.ok(p.stdout.includes('EDEN'))

    p = new Shell(`${apollo} feature search ${P} -a foobar -t EDEN`)
    assert.strictEqual('[]', p.stdout.trim())
    assert.ok(p.stderr.includes('Warning'))

    p = new Shell(`${apollo} feature search ${P} -a vv1 -t foobarspam`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // It searches attributes values, not attribute names
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t multivalue`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // Search feature type
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    assert.ok(p.stdout.includes('"type": "contig"'))

    // Search source (which in fact is an attribute)
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t someExample`)
    assert.ok(p.stdout.includes('SomeContig'))

    // Case insensitive
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t SOMEexample`)
    assert.ok(p.stdout.includes('SomeContig'))

    // No partial word match
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t Fingerpri`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // Match full word not necessarily full value
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t Fingerprinted`)
    assert.ok(p.stdout.includes('Fingerprinted'))

    // Does not search contig names (reference sequence name)
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t ctgB`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // Does not match common words (?) ...
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t with`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // ...But "fake" is ok
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t fake`)
    assert.ok(p.stdout.includes('FakeSNP1'))

    // ...or a single unusual letter
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t Q`)
    assert.ok(p.stdout.includes('"Q"'))
  })

  void globalThis.itName('Get feature by indexed ID', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv2`)

    // Search multiple assemblies
    let p = new Shell(`${apollo} feature get-indexed-id ${P} MyGene -a vv1 vv2`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
    assert.ok(p.stdout.includes('MyGene'))

    // Specifying no assembly defaults to searching all assemblies
    p = new Shell(`${apollo} feature get-indexed-id ${P} MyGene`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
    assert.ok(p.stdout.includes('MyGene'))

    // Search single assembly
    p = new Shell(`${apollo} feature get-indexed-id ${P} MyGene -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.ok(p.stdout.includes('MyGene'))

    // Warn on unknown assembly
    p = new Shell(`${apollo} feature get-indexed-id ${P} EDEN -a foobar`)
    assert.strictEqual('[]', p.stdout.trim())
    assert.ok(p.stderr.includes('Warning'))

    // Return empty array with no matches
    p = new Shell(`${apollo} feature get-indexed-id ${P} foobarspam -a vv1`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // Gets subfeature
    p = new Shell(`${apollo} feature get-indexed-id ${P} myCDS.1 -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.ok(out.at(0)?.type === 'CDS')

    // Gets top-level feature from subfeature id
    p = new Shell(
      `${apollo} feature get-indexed-id ${P} myCDS.1 -a vv1 --topLevel`,
    )
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.ok(out.at(0)?.type === 'gene')

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
    assert.strictEqual(out.length, 1)
    assert.ok(p.stdout.includes('match1'))
    p = new Shell(`${apollo} feature get-indexed-id ${P} matchPart1 -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.ok(p.stdout.includes('matchPart1'))

    // Doesn't get child feature after it was deleted
    const idToDelete = out[0]._id
    new Shell(`${apollo} feature delete ${P} -i ${idToDelete}`)
    p = new Shell(`${apollo} feature get-indexed-id ${P} matchPart1 -a vv1`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

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
    assert.strictEqual(out.length, 1)
    assert.ok(p.stdout.includes('match2'))

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
    assert.strictEqual(out.length, 1)
    assert.ok(p.stdout.includes('matchPart2'))

    // Doesn't get feature or child after IDs were manually removed
    new Shell(`${apollo} feature edit-attribute ${P} -i ${_id} -a gff_id -d`)
    const childId = out[0]._id
    new Shell(
      `${apollo} feature edit-attribute ${P} -i ${childId} -a gff_id -d`,
    )
    p = new Shell(`${apollo} feature get-indexed-id ${P} match2 -a vv1`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')
    p = new Shell(`${apollo} feature get-indexed-id ${P} matchPart2 -a vv1`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')
  })

  void globalThis.itName('Delete features', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new Shell(`${apollo} feature search ${P} -a vv1 -t EDEN`)
    const fid = JSON.parse(p.stdout).at(0)._id

    p = new Shell(`${apollo} feature delete ${P} -i ${fid} --dry-run`)
    assert.ok(p.stdout.includes(fid))

    new Shell(`${apollo} feature delete ${P} -i ${fid}`)
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t EDEN`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    p = new Shell(`${apollo} feature delete ${P} -i ${fid}`, false)
    assert.strictEqual(p.returncode, 1)
    assert.ok(
      p.stderr.includes('The following featureId was not found in database'),
    )

    p = new Shell(`${apollo} feature delete ${P} --force -i ${fid}`)
    assert.strictEqual(p.returncode, 0)
  })

  void globalThis.itName('Add features', () => {
    let p = new Shell(`${apollo} assembly get ${P} -a tinyGz`)
    let out = JSON.parse(p.stdout)
    const assemblyId = out.at(0)._id
    p = new Shell(`${apollo} feature get ${P} -a tinyGz`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')
    // Can add a feature using flags
    p = new Shell(
      `${apollo} feature add ${P} -a tinyGz -r ctgA -s 1 -e 10 -t remark`,
    )
    JSON.parse(p.stdout)
    p = new Shell(`${apollo} feature get ${P} -a tinyGz`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    const refSeqId = out[0].refSeq
    // Can add a feature using assembly and refSeq ids
    new Shell(
      `${apollo} feature add ${P} -a ${assemblyId} -r ${refSeqId} -s 11 -e 20 -t remark`,
    )
    p = new Shell(`${apollo} feature get ${P} -a ${assemblyId}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
    // Can add a feature using JSON arg
    new Shell(
      `${apollo} feature add ${P} '{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":21,"max":30,"type":"remark"}'`,
    )
    p = new Shell(`${apollo} feature get ${P} -a ${assemblyId}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 3)
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
    assert.strictEqual(out.length, 4)
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
    assert.strictEqual(out.length, 5)
    // Can add multiple features using JSON
    new Shell(
      `${apollo} feature add ${P} '[{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":51,"max":60,"type":"remark"},{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":61,"max":70,"type":"remark"}]'`,
    )
    p = new Shell(`${apollo} feature get ${P} -a ${assemblyId}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 7)
    // Can add a feature with children from JSON
    new Shell(
      `${apollo} feature add ${P} '{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":71,"max":80,"type":"match","children":[{"min":71,"max":75,"type":"match_part"}]}'`,
    )
    p = new Shell(
      `${apollo} feature get ${P} -a ${assemblyId} -r ${refSeqId} -s 71 -e 80`,
    )
    out = JSON.parse(p.stdout)
    let feature = out.at(0)
    assert.strictEqual(Object.keys(feature?.children).length, 1)
    // Can add a feature with attributes from JSON
    new Shell(
      `${apollo} feature add ${P} '{"assembly":"${assemblyId}","refSeq":"${refSeqId}","min":81,"max":90,"type":"remark","attributes":{"key1":["val1"]}}'`,
    )
    p = new Shell(
      `${apollo} feature get ${P} -a ${assemblyId} -r ${refSeqId} -s 81 -e 90`,
    )
    out = JSON.parse(p.stdout)
    feature = out.at(0)
    assert.strictEqual(feature?.attributes?.key1?.[0], 'val1')
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
    assert.strictEqual(keys.length, 1)
    assert.strictEqual(feature.children[keys[0]].attributes.key2[0], 'val2')
  })

  void globalThis.itName('Add child features', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    const fid = JSON.parse(p.stdout).at(0)._id

    new Shell(
      `${apollo} feature add-child ${P} -i ${fid} -s 10 -e 20 -t contig_read`,
    )
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig_read`)
    assert.ok(p.stdout.includes('contig_read'))
    assert.ok(p.stdout.includes('"min": 9'))
    assert.ok(p.stdout.includes('"max": 20'))

    p = new Shell(
      `${apollo} feature add-child ${P} -i ${fid} -s 10 -e 2000 -t contig_read`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('Child feature coordinates'))

    // Should this fail?
    p = new Shell(
      `${apollo} feature add-child ${P} -i ${fid} -s 10 -e 20 -t FOOBAR`,
      false,
    )
    assert.strictEqual(p.returncode, 0)
  })

  void globalThis.itName('Import features', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    // Import again: Add to existing feature
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 4)

    // Import again: delete ${P} existing
    new Shell(
      `${apollo} feature import ${P} -d test_data/tiny.fasta.gff3 -a vv1`,
    )
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    p = new Shell(
      `${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a doesNotExist`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('Assembly "doesNotExist" does not exist'))

    p = new Shell(`${apollo} feature import ${P} foo.gff3 -a vv1`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('File "foo.gff3" does not exist'))
  })

  void globalThis.itName('Copy feature', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    const fid = JSON.parse(p.stdout).at(0)._id

    new Shell(`${apollo} feature copy ${P} -i ${fid} -r ctgA -a vv2 -s 1`)
    p = new Shell(`${apollo} feature search ${P} -a vv2 -t contig`)
    let out = JSON.parse(p.stdout).at(0)
    assert.strictEqual(out.min, 0)
    assert.strictEqual(out.max, 50)

    // RefSeq id does not need assembly
    p = new Shell(`${apollo} refseq get ${P} -a vv3`)
    const destRefSeq = JSON.parse(p.stdout).find(
      (x: any) => x.name === 'ctgA',
    )._id

    new Shell(`${apollo} feature copy ${P} -i ${fid} -r ${destRefSeq} -s 2`)
    p = new Shell(`${apollo} feature search ${P} -a vv3 -t contig`)
    out = JSON.parse(p.stdout).at(0)
    assert.strictEqual(out.min, 1)
    assert.strictEqual(out.max, 51)

    // Copy to same assembly
    new Shell(`${apollo} feature copy ${P} -i ${fid} -r ctgA -a vv1 -s 10`)
    p = new Shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    JSON.parse(p.stdout)

    // Copy non-existant feature or refseq
    p = new Shell(
      `${apollo} feature copy ${P} -i FOOBAR -r ctgA -a vv2 -s 1`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('ERROR'))

    p = new Shell(
      `${apollo} feature copy ${P} -i ${fid} -r FOOBAR -a vv2 -s 1`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('No reference'))

    // Ambiguous refseq
    p = new Shell(`${apollo} feature copy ${P} -i ${fid} -r ctgA -s 1`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('more than one'))
  })

  void globalThis.itName('Get changes', () => {
    let p = new Shell(`${apollo} assembly get ${P} -a vv1 vv2 vv3`)
    const assemblies = JSON.parse(p.stdout)
    const vv1Id = assemblies.find((x: any) => x.name === 'vv1')._id
    const vv2Id = assemblies.find((x: any) => x.name === 'vv2')._id
    const vv3Id = assemblies.find((x: any) => x.name === 'vv3')._id

    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv2`)
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv3`)

    p = new Shell(`${apollo} change get ${P}`)
    let out = JSON.parse(p.stdout)
    assert.ok(out.some((x: any) => x.assembly === vv1Id))
    assert.ok(out.some((x: any) => x.assembly === vv2Id))

    p = new Shell(`${apollo} change get ${P} -a vv1 vv3`)
    out = JSON.parse(p.stdout)
    assert.ok(out.some((x: any) => x.assembly === vv1Id))
    assert.ok(out.some((x: any) => x.assembly === vv3Id))
    assert.ok(out.every((x: any) => x.assembly !== vv2Id))

    // Querying changes by an assembly name that was never seeded returns
    // nothing.
    p = new Shell(`${apollo} change get ${P} -a doesNotExist`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)
  })

  void globalThis.itName('Get sequence', () => {
    let p = new Shell(`${apollo} assembly sequence ${P} -a nonExistant`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('returned 0 assemblies'))

    p = new Shell(`${apollo} assembly sequence ${P} -a vv1 -s 0`, false)
    assert.ok(p.returncode != 0)
    assert.match(p.stderr, /must be greater than 0/)

    p = new Shell(`${apollo} assembly sequence ${P} -a vv1`)
    let seq = p.stdout.split(' ')
    assert.strictEqual(seq.length, 25)
    assert.deepStrictEqual(seq.at(0), '>ctgA:1..420')
    assert.deepStrictEqual(
      seq.at(1),
      'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcct',
    )
    assert.deepStrictEqual(seq.at(6), 'ttggtcgctccgttgtaccc')
    assert.deepStrictEqual(seq.at(7), '>ctgB:1..800')
    assert.deepStrictEqual(seq.at(-1), 'ttggtcgctccgttgtaccc')

    p = new Shell(`${apollo} assembly sequence ${P} -a vv1 -r ctgB -s 1 -e 1`)
    seq = p.stdout.split(' ')
    assert.deepStrictEqual(seq.at(0), '>ctgB:1..1')
    assert.deepStrictEqual(seq.at(1), 'A')

    p = new Shell(`${apollo} assembly sequence ${P} -a vv1 -r ctgB -s 2 -e 4`)
    seq = p.stdout.split(' ')
    assert.deepStrictEqual(seq.at(0), '>ctgB:2..4')
    assert.deepStrictEqual(seq.at(1), 'CAT')

    p = new Shell(`${apollo} assembly sequence ${P} -r ctgB`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('found in more than one'))
  })

  void globalThis.itName('Get feature by id', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new Shell(`${apollo} feature get ${P} -a vv1`)
    const ff = JSON.parse(p.stdout)

    const x1 = ff.at(0)._id
    const x2 = ff.at(1)._id
    p = new Shell(`${apollo} feature get-id ${P} -i ${x1} ${x1} ${x2}`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
    assert.deepStrictEqual(out.at(0)._id, x1)
    assert.deepStrictEqual(out.at(1)._id, x2)

    p = new Shell(`${apollo} feature get-id ${P} -i FOOBAR`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    p = new Shell(`echo -e '${x1} \n ${x2}' | ${apollo} feature get-id ${P}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
  })

  void globalThis.itName('Assembly checks', () => {
    // TODO: Improve tests once more checks exist (currently there is only
    // CDSCheck)
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)

    // Test view available check type
    let p = new Shell(`${apollo} assembly check ${P}`)
    let out = JSON.parse(p.stdout)
    assert.ok(p.stdout.includes('CDSCheck'))
    assert.ok(p.stdout.includes('TranscriptCheck'))
    const cdsCheckId = out.find((x: any) => x.name === 'CDSCheck')._id

    // Test view checks set for assembly
    p = new Shell(`${apollo} assembly check ${P} -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    // Test non-existant assembly
    p = new Shell(`${apollo} assembly check ${P} -a non-existant`, false)
    assert.strictEqual(p.returncode, 1)
    assert.ok(p.stderr.includes('non-existant'))

    // Test non-existant check
    p = new Shell(`${apollo} assembly check ${P} -a vv1 -c not-a-check`, false)
    assert.strictEqual(p.returncode, 1)
    assert.ok(p.stderr.includes('not-a-check'))

    // Test add checks. Test check is added as opposed to replacing current
    // checks with input list
    new Shell(`${apollo} assembly check ${P} -a vv1 -c CDSCheck CDSCheck`)
    p = new Shell(`${apollo} assembly check ${P} -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
    assert.deepStrictEqual(out.at(0).name, 'CDSCheck')

    // Works also with check id
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv2`)
    new Shell(`${apollo} assembly check ${P} -a vv2 -c ${cdsCheckId}`)
    p = new Shell(`${apollo} assembly check ${P} -a vv2`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
    assert.deepStrictEqual(out.at(0).name, 'CDSCheck')

    // Delete check
    new Shell(`${apollo} assembly check ${P} -a vv1 -d -c CDSCheck`)
    p = new Shell(`${apollo} assembly check ${P} -a vv1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.ok(!p.stdout.includes('CDSCheck'))
    assert.ok(p.stdout.includes('TranscriptCheck'))
  })

  void globalThis.itName('Feature checks', () => {
    new Shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    new Shell(`${apollo} assembly check ${P} -a vv1 -c CDSCheck`)
    let p = new Shell(`${apollo} feature check ${P} -a vv1`)
    const out = JSON.parse(p.stdout)
    assert.ok(out.length > 1)
    assert.ok(p.stdout.includes('InternalStopCodon'))

    // Ids with checks
    const ids: string[] = out.map((x: any) => x.ids)
    assert.ok(new Set(ids).size > 1)

    // Retrieve by feature id
    const xid = [...ids].join(' ')
    p = new Shell(`${apollo} feature check ${P} -i ${xid}`)
    assert.ok(p.stdout.includes('InternalStopCodon'))
  })

  void globalThis.itName('Feature checks indexed', () => {
    new Shell(`${apollo} assembly check ${P} -a tinyGz -c CDSCheck`)
    new Shell(
      `${apollo} feature import ${P} -a tinyGz test_data/tiny.fasta.gff3 -d`,
    )
    let p = new Shell(`${apollo} feature check ${P} -a tinyGz`)
    const out = JSON.parse(p.stdout)
    assert.ok(out.length > 1)
    assert.ok(p.stdout.includes('InternalStopCodon'))

    // Ids with checks
    const ids: string[] = out.map((x: any) => x.ids)
    assert.ok(new Set(ids).size > 1)

    // Retrieve by feature id
    const xid = [...ids].join(' ')
    p = new Shell(`${apollo} feature check ${P} -i ${xid}`)
    assert.ok(p.stdout.includes('InternalStopCodon'))
  })

  void globalThis.itName(
    'Delete check results when unregistering a check',
    () => {
      new Shell(
        `${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`,
      )
      let p = new Shell(`${apollo} feature check ${P} -a vv1`)
      let checkResults = JSON.parse(p.stdout) as CheckResultSnapshot[]
      assert.ok(checkResults.length > 1)

      // Delete all checks and consequently delete all check results
      p = new Shell(`${apollo} assembly check ${P} -a vv1`)
      const checkNames = (JSON.parse(p.stdout) as CheckResultSnapshot[]).map(
        (x) => x.name,
      )
      new Shell(
        `${apollo} assembly check ${P} -a vv1 -d -c ${checkNames.join(' ')}`,
      )
      p = new Shell(`${apollo} feature check ${P} -a vv1`)
      checkResults = JSON.parse(p.stdout)
      assert.deepEqual(checkResults.length, 0)

      // Put one check back
      new Shell(`${apollo} assembly check ${P} -a vv1 -c CDSCheck`)
      p = new Shell(`${apollo} feature check ${P} -a vv1`)
      checkResults = JSON.parse(p.stdout)
      assert.ok(checkResults.length > 0)
      assert.deepEqual(
        checkResults.filter((x) => x.name === 'CDSCheck').length,
        checkResults.length,
      )
    },
  )

  void globalThis.itName('User', () => {
    let p = new Shell(`${apollo} user get ${P}`)
    let out = JSON.parse(p.stdout)
    assert.ok(out.length > 0)

    p = new Shell(`${apollo} user get ${P} -r admin`)
    const out2 = JSON.parse(p.stdout)
    assert.ok(out.length > 0)
    assert.ok(out.length > out2.length)

    p = new Shell(`${apollo} user get ${P} -r admin -u root`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)

    p = new Shell(`${apollo} user get ${P} -r readOnly -u root`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)
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
    assert.ok(p.stdout.includes('testAdmin2: Logged in'))
    assert.ok(p.stdout.includes('createdAt'))
  })

  void globalThis.itName('Apollo config create env', () => {
    let p = new Shell(
      `\
            export APOLLO_DISABLE_CONFIG_CREATE=1
            rm -f tmp.yml
            ${apollo} config --config-file tmp.yml address http://localhost:3999`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('does not exist yet'))
    assert.ok(!fs.existsSync('tmp.yml'))

    p = new Shell(
      `\
            export APOLLO_DISABLE_CONFIG_CREATE=0
            rm -f tmp.yml
            ${apollo} config --config-file tmp.yml address http://localhost:3999`,
    )
    assert.strictEqual(0, p.returncode)
    assert.ok(fs.existsSync('tmp.yml'))

    p = new Shell(
      `\
            unset APOLLO_DISABLE_CONFIG_CREATE
            rm -f tmp.yml
            ${apollo} config --config-file tmp.yml address http://localhost:3999`,
    )
    assert.strictEqual(0, p.returncode)
    assert.ok(fs.existsSync('tmp.yml'))

    fs.unlinkSync('tmp.yml')
  })

  void globalThis.itName('Invalid access', () => {
    const p = new Shell(`${apollo} user get --profile foo`, false)
    assert.strictEqual(1, p.returncode)
    assert.ok(p.stderr.includes('Profile "foo" does not exist'))
  })

  // Works locally but fails on github
  void globalThis.itName('Login', () => {
    // This should wait for user's input
    const p = new Shell(`${apollo} login ${P}`, false, 5000)
    assert.ok(p.returncode != 0)
    // This should be ok
    new Shell(`${apollo} login ${P} --force`, true, 5000)
  })

  void globalThis.itName('File upload', () => {
    let p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    let out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out.type, 'text/x-fasta')
    assert.ok(out._id)

    p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out.type, 'text/x-fasta')

    p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta.gff3`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out.type, 'text/x-gff3')

    p = new Shell(`${apollo} file upload ${P} test_data/guest.yaml`, false)
    assert.ok(p.returncode != 0)

    p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta.gz`, false)
    assert.ok(p.stderr.includes('it may be gzip or bgzip compressed'))
    assert.ok(p.returncode != 0)
  })

  void globalThis.itName('File upload gzip', () => {
    // Uploading a gzip file must skip compression and just copy the file
    const gz = fs.readFileSync('test_data/tiny.fasta.gz')
    const md5 = crypto.createHash('md5').update(gz).digest('hex')

    const p = new Shell(
      `${apollo} file upload ${P} test_data/tiny.fasta.gz -t text/x-fasta`,
    )
    const out = JSON.parse(p.stdout)
    assert.strictEqual(out.checksum, md5)
  })

  void globalThis.itName('Get files', () => {
    new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    let p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const fid = JSON.parse(p.stdout)._id

    p = new Shell(`${apollo} file get ${P}`)
    let out = JSON.parse(p.stdout)
    assert.ok(out.length >= 2)
    assert.ok(out.filter((x: any) => x._id === fid))

    p = new Shell(`${apollo} file get ${P} -i ${fid} ${fid}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)

    p = new Shell(`${apollo} file get ${P} -i nonexists`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)
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
    assert.ok(down.startsWith('>'))
    assert.ok(down.trim().endsWith('accc'))
    fs.unlinkSync(up.basename)

    new Shell(`${apollo} file download ${P} -i ${up._id} -o tmp.fa`)
    down = fs.readFileSync('tmp.fa').toString()
    assert.ok(down.startsWith('>'))
    assert.ok(down.trim().endsWith('accc'))
    fs.unlinkSync('tmp.fa')

    p = new Shell(`${apollo} file download ${P} -i ${up._id} -o -`)
    assert.ok(p.stdout.startsWith('>'))
    assert.ok(p.stdout.trim().endsWith('accc'))
  })

  void globalThis.itName('Delete file', () => {
    let p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const up1 = JSON.parse(p.stdout)
    p = new Shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const up2 = JSON.parse(p.stdout)

    p = new Shell(`${apollo} file delete ${P} -i ${up1._id} ${up2._id}`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    p = new Shell(`${apollo} file get ${P} -i ${up1._id} ${up2._id}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)
  })

  void globalThis.itName('Export gff3', () => {
    new Shell(
      `${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a tinyGz`,
    )
    let p = new Shell(`${apollo} export gff3 ${P} tinyGz --include-fasta`)
    let gff = p.stdout
    assert.match(gff, /^##gff-version 3/)
    assert.match(gff, /multivalue=val1,val2,val3/)
    assert.match(gff, /##FASTA/)
    assert.match(gff, /taccc$/)

    p = new Shell(`${apollo} export gff3 ${P} tinyGz`)
    gff = p.stdout
    assert.match(gff, /^##gff-version 3/)
    assert.match(gff, /multivalue=val1,val2,val3/)
    assert.doesNotMatch(gff, /##FASTA/)

    // Invalid assembly
    p = new Shell(`${apollo} export gff3 ${P} foobar`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('foobar'))
  })

  void globalThis.itName('Export gff3 from external assembly', () => {
    new Shell(
      `${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a external`,
    )
    let p = new Shell(`${apollo} export gff3 ${P} external --include-fasta`)
    let gff = p.stdout
    assert.match(gff, /^##gff-version 3/)
    assert.match(gff, /multivalue=val1,val2,val3/)
    assert.match(gff, /##FASTA/)
    assert.match(gff, /taccc$/)

    p = new Shell(`${apollo} export gff3 ${P} external`)
    gff = p.stdout
    assert.match(gff, /^##gff-version 3/)
    assert.match(gff, /multivalue=val1,val2,val3/)
    assert.doesNotMatch(gff, /##FASTA/)
  })

  void globalThis.itName(
    'Position of internal stop codon warning in forward',
    () => {
      new Shell(
        `${apollo} feature import ${P} test_data/warningPositionForward.gff -a warningPositionForward`,
      )
      deleteAllChecks(apollo, P, 'warningPositionForward')
      new Shell(
        `${apollo} assembly check ${P} -a warningPositionForward -c CDSCheck`,
      )

      const p = new Shell(
        `${apollo} feature check ${P} -a warningPositionForward`,
      )
      const out = JSON.parse(p.stdout)
      assert.deepStrictEqual(out.length, 2)

      assert.deepStrictEqual(out.at(0).cause, 'InternalStopCodon')
      assert.deepStrictEqual(out.at(0).start, 9)
      assert.deepStrictEqual(out.at(0).end, 15)

      assert.deepStrictEqual(out.at(1).cause, 'InternalStopCodon')
      assert.deepStrictEqual(out.at(1).start, 21)
      assert.deepStrictEqual(out.at(1).end, 24)
    },
  )

  void globalThis.itName(
    'Position of internal stop codon warning in reverse',
    () => {
      new Shell(
        `${apollo} feature import ${P} test_data/warningPositionReverse.gff -a warningPositionReverse`,
      )
      deleteAllChecks(apollo, P, 'warningPositionReverse')
      new Shell(
        `${apollo} assembly check ${P} -a warningPositionReverse -c CDSCheck`,
      )
      const p = new Shell(
        `${apollo} feature check ${P} -a warningPositionReverse`,
      )
      const out = JSON.parse(p.stdout)
      assert.deepStrictEqual(out.length, 2)
      assert.deepStrictEqual(out.at(0).cause, 'InternalStopCodon')
      assert.deepStrictEqual(out.at(0).start, 3)
      assert.deepStrictEqual(out.at(0).end, 18)

      assert.deepStrictEqual(out.at(1).cause, 'InternalStopCodon')
      assert.deepStrictEqual(out.at(1).start, 18)
      assert.deepStrictEqual(out.at(1).end, 21)
    },
  )

  void globalThis.itName('Detect missing start codon forward', () => {
    new Shell(
      `${apollo} feature import ${P} test_data/missingStartCodonForward.gff3 -a missingStartCodonForward`,
    )
    deleteAllChecks(apollo, P, 'missingStartCodonForward')
    new Shell(
      `${apollo} assembly check ${P} -a missingStartCodonForward -c CDSCheck`,
    )
    const p = new Shell(
      `${apollo} feature check ${P} -a missingStartCodonForward`,
    )
    const out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.deepStrictEqual(out.at(0).cause, 'MissingStartCodon')
    assert.deepStrictEqual(out.at(0).start, 3)
    assert.deepStrictEqual(out.at(0).end, 3)
    assert.ok(out.at(0).message.includes('TTG'))
  })

  void globalThis.itName('Detect missing start codon reverse', () => {
    new Shell(
      `${apollo} feature import ${P} test_data/missingStartCodonReverse.gff3 -a missingStartCodonReverse`,
    )
    deleteAllChecks(apollo, P, 'missingStartCodonReverse')
    new Shell(
      `${apollo} assembly check ${P} -a missingStartCodonReverse -c CDSCheck`,
    )
    const p = new Shell(
      `${apollo} feature check ${P} -a missingStartCodonReverse`,
    )
    const out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.deepStrictEqual(out.at(0).cause, 'MissingStartCodon')
    assert.deepStrictEqual(out.at(0).start, 23)
    assert.deepStrictEqual(out.at(0).end, 23)
    assert.ok(out.at(0).message.includes('agC'))
  })

  void globalThis.itName('Edit exon inferred from CDS', () => {
    new Shell(
      `${apollo} feature import ${P} test_data/cdsWithoutExon.gff3 -a cdsWithoutExon`,
    )
    let p = new Shell(
      `${apollo} feature search ${P} -t mrna01 -a cdsWithoutExon`,
    )
    let out = JSON.parse(p.stdout)
    const gene: any = out.at(0)
    const mrna: any = Object.values(gene.children).at(0)
    const cdsExon: AnnotationFeature[] = Object.values(mrna.children)
    const exon = cdsExon.filter((x: any) => x.type === 'exon')
    assert.deepStrictEqual(exon.length, 1)
    const exon_id = exon[0]._id

    // Before edit
    p = new Shell(`${apollo} feature get-id ${P} -i ${exon_id}`)
    out = JSON.parse(p.stdout) as AnnotationFeature[]
    assert.deepStrictEqual(out.at(0)?.max, 20)

    // After edit
    new Shell(`${apollo} feature edit-coords ${P} -i ${exon_id} -e 30`)
    p = new Shell(`${apollo} feature get-id ${P} -i ${exon_id}`)
    out = JSON.parse(p.stdout) as AnnotationFeature[]
    assert.deepStrictEqual(out.at(0)?.max, 30)
  })

  void globalThis.itName('Check splice site', () => {
    new Shell(
      `${apollo} feature import ${P} test_data/checkSplice.fasta.gff3 -a checkSplice`,
    )
    deleteAllChecks(apollo, P, 'checkSplice')
    new Shell(`${apollo} assembly check ${P} -a checkSplice -c TranscriptCheck`)

    let p = new Shell(`${apollo} feature get ${P} -a checkSplice`)
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
      `${apollo} feature check ${P} -a checkSplice -i ${okMrnaId.join(' ')}`,
    )
    let out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out, [])

    // Check forward transcript
    p = new Shell(
      `${apollo} feature check ${P} -a checkSplice -i ${warnMrnaIdForw}`,
    )
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 4)
    let chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtFivePrime' && x.start === 11,
    )
    assert.strictEqual(chk.length, 1)
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtFivePrime' && x.start === 31,
    )
    assert.strictEqual(chk.length, 1)
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtThreePrime' && x.start === 17,
    )
    assert.strictEqual(chk.length, 1)
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtThreePrime' && x.start === 37,
    )
    assert.strictEqual(chk.length, 1)

    // Check reverse transcript
    p = new Shell(
      `${apollo} feature check ${P} -a checkSplice -i ${warnMrnaIdRev}`,
    )
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 4)
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtThreePrime' && x.start === 11,
    )
    assert.strictEqual(chk.length, 1)
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtThreePrime' && x.start === 31,
    )
    assert.strictEqual(chk.length, 1)
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtFivePrime' && x.start === 17,
    )
    assert.strictEqual(chk.length, 1)
    chk = out.filter(
      (x: any) =>
        x.cause === 'NonCanonicalSpliceSiteAtFivePrime' && x.start === 37,
    )
    assert.strictEqual(chk.length, 1)
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
      assert.notStrictEqual(p.returncode, 0)
      assert.ok(p.stderr.includes('UND_ERR_HEADERS_TIMEOUT'))

      // Timeout longer than the server's response delay: the request
      // should succeed.
      p = new Shell(
        `${apollo} assembly get --profile fakeTimeout --timeout 10s`,
      )
      assert.strictEqual(p.stdout.trim(), '[]')
    } finally {
      server.kill()
      fs.unlinkSync(serverScript)
    }
  })
})
