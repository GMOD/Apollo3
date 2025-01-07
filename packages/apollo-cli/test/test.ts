/**
 * USAGE
 * From package root directory (`packages/apollo-cli`). Run all tests:
 *
 * yarn tsx test/test.ts
 *
 * Run only matching pattern:
 *
 * yarn tsx --test-name-pattern='Print help|Feature get' test/test.ts
 */

import assert from 'node:assert'
import { before, describe, it } from 'node:test'
import { shell } from './utils'
import { createWriteStream, unlinkSync, writeFileSync } from 'fs'

const apollo = 'yarn dev'
const P = '--profile testAdmin'

describe('Test CLI', () => {
  before(() => {
    //new shell(`${apollo} config ${P} address http://localhost:3999`)
    //new shell(`${apollo} config ${P} accessType root`)
    //new shell(`${apollo} config ${P} rootPassword pass`)
    //new shell(`${apollo} login ${P} -f`)
  })

  globalThis.itName('Print help', () => {
    const p = new shell(`${apollo} --help`)
    assert.ok(p.stdout.includes('COMMANDS'))
  })

  globalThis.itName('Get config file', () => {
    const p = new shell(`${apollo} config --get-config-file`)
    assert.ok(p.stdout.startsWith('/'))
  })

  globalThis.itName('Config invalid keys', () => {
    let p = new shell(`${apollo} config ${P} address spam`, false)
    assert.strictEqual(1, p.returncode)
    assert.ok(p.stderr.includes('Invalid setting:'))

    p = new shell(`${apollo} config ${P} ADDRESS http://localhost:3999`, false)
    assert.strictEqual(1, p.returncode)
    assert.ok(p.stderr.includes('Invalid setting:'))

    p = new shell(`${apollo} config ${P} accessType spam`, false)
    assert.strictEqual(1, p.returncode)
    assert.ok(p.stderr.includes('Invalid setting:'))
  })

  globalThis.itName('Can change access type', () => {
    const p = new shell(`${apollo} config ${P} accessType google`)
    assert.strictEqual('', p.stdout.trim())
  })

  globalThis.itName('Apollo status', () => {
    let p = new shell(`${apollo} status ${P}`)
    assert.strictEqual(p.stdout.trim(), 'testAdmin: Logged in')

    new shell(`${apollo} logout ${P}`)
    p = new shell(`${apollo} status ${P}`)
    assert.strictEqual(p.stdout.trim(), 'testAdmin: Logged out')

    new shell(`${apollo} login ${P}`)
  })

  globalThis.itName('Feature get', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv2 -f`,
    )

    let p = new shell(`${apollo} feature get ${P} -a vv1`)
    assert.ok(p.stdout.includes('ctgA'))
    assert.ok(p.stdout.includes('SomeContig'))

    p = new shell(`${apollo} feature get ${P} -r ctgA`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('found in more than one assembly'))

    p = new shell(`${apollo} feature get ${P} -a vv1 -r ctgA`)
    let out = JSON.parse(p.stdout)
    assert.ok(Object.keys(out[0]).length > 2)

    p = new shell(`${apollo} feature get ${P} -a vv1 -r ctgA -s 40 -e 41`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)

    p = new shell(`${apollo} feature get ${P} -a vv1 -r ctgA -s 1000 -e 1000`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out, [])

    p = new shell(`${apollo} feature get ${P} -r FOOBAR`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out, [])

    p = new shell(`${apollo} feature get ${P} -a FOOBAR -r ctgA`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('returned 0 assemblies'))
  })

  globalThis.itName('Assembly get', () => {
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv1 -e -f`,
    )
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv2 -e -f`,
    )
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv3 -e -f`,
    )
    let p = new shell(`${apollo} assembly get ${P}`)
    assert.ok(p.stdout.includes('vv1'))
    assert.ok(p.stdout.includes('vv2'))
    assert.ok(p.stdout.includes('vv3'))

    p = new shell(`${apollo} assembly get ${P} -a vv1 vv2`)
    assert.ok(p.stdout.includes('vv1'))
    assert.ok(p.stdout.includes('vv2'))
    assert.ok(p.stdout.includes('vv3') == false)

    const out = JSON.parse(p.stdout)
    const aid = out.filter((x) => x.name === 'vv1').at(0)._id
    p = new shell(`${apollo} assembly get ${P} -a ${aid} vv2`)
    assert.ok(p.stdout.includes('vv1'))
    assert.ok(p.stdout.includes('vv2'))
    assert.ok(p.stdout.includes('vv3') == false)
  })

  globalThis.itName('Delete assembly', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a volvox1 -f`,
    )
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a volvox2 -f`,
    )
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a volvox3 -f`,
    )
    let p = new shell(
      `${apollo} assembly get ${P} | jq '.[] | select(.name == "volvox1") | ._id'`,
    )
    const aid = p.stdout.trim()

    p = new shell(`${apollo} assembly delete ${P} -v -a ${aid} volvox2 volvox2`)
    const out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
    assert.ok(p.stderr.includes('2 '))

    new shell(`${apollo} assembly delete ${P} -a ${aid} volvox2`)
    p = new shell(`${apollo} assembly get ${P}`)
    assert.ok(p.stdout.includes(aid) == false)
    assert.ok(p.stdout.includes('volvox1') == false)
    assert.ok(p.stdout.includes('volvox2') == false)
    assert.ok(p.stdout.includes('volvox3'))
  })

  globalThis.itName('Id reader', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v1 -f`,
    )
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v2 -f`,
    )
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v3 -f`,
    )
    let p = new shell(`${apollo} assembly get ${P}`)
    const xall = JSON.parse(p.stdout)

    p = new shell(`${apollo} assembly get ${P} -a v1 v2`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    // This is interpreted as an assembly named 'v1 v2'
    p = new shell(`echo v1 v2 | ${apollo} assembly get ${P} -a -`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)

    // These are two assemblies
    p = new shell(`echo -e 'v1 \n v2' | ${apollo} assembly get ${P} -a -`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    p = new shell(
      `${apollo} assembly get ${P} | ${apollo} assembly get ${P} -a -`,
    )
    out = JSON.parse(p.stdout)
    assert.ok(out.length >= 3)

    // From json file
    new shell(`${apollo} assembly get ${P} > test_data/tmp.json`)
    p = new shell(`${apollo} assembly get ${P} -a test_data/tmp.json`)
    out = JSON.parse(p.stdout)
    assert.ok(out.length >= 3)
    unlinkSync('test_data/tmp.json')

    // From text file, one name or id per line
    writeFileSync('test_data/tmp.txt', 'v1 \n v2 \r\n v3 \n')
    p = new shell(`${apollo} assembly get ${P} -a test_data/tmp.txt`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 3)
    unlinkSync('test_data/tmp.txt')

    // From json string
    const aid = xall.at(0)._id
    let j = `{"_id": "${aid}"}`
    p = new shell(`${apollo} assembly get ${P} -a '${j}'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.strictEqual(out.at(0)._id, aid)

    const id1 = xall.at(0)._id
    const id2 = xall.at(1)._id
    j = `[{"_id": "${id1}"}, {"_id": "${id2}"}]`
    p = new shell(`${apollo} assembly get ${P} -a '${j}'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    j = `{"XYZ": "${aid}"}`
    p = new shell(`${apollo} assembly get ${P} -a '${j}'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)

    p = new shell(`${apollo} assembly get ${P} -a '[...'`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)
  })

  globalThis.itName('Add assembly from gff', () => {
    let p = new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 --omit-features -f`,
    )
    const out = JSON.parse(p.stdout)
    assert.ok(Object.keys(out.fileIds).includes('fa'))

    // Get id of assembly named vv1 and check there are no features
    p = new shell(`${apollo} assembly get ${P} -a vv1`)
    assert.ok(p.stdout.includes('vv1'))
    assert.ok(p.stdout.includes('vv2') == false)
    const asm_id = JSON.parse(p.stdout).at(0)._id

    p = new shell(`${apollo} refseq get ${P}`)
    const refseq = JSON.parse(p.stdout.trim())
    const vv1ref = refseq.filter((x) => x.assembly === asm_id) // [x for x in refseq if x["assembly"] == asm_id]
    const refseq_id = vv1ref.filter((x) => x.name === 'ctgA').at(0)._id // [x["_id"] for x in vv1ref if x["name"] == "ctgA"][0]

    p = new shell(`${apollo} feature get ${P} -r ${refseq_id}`)
    const ff = JSON.parse(p.stdout)
    assert.deepStrictEqual(ff, [])

    p = new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('Error: Assembly "vv1" already exists'))

    // Default assembly name
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -f`,
    )
    p = new shell(`${apollo} assembly get ${P} -a tiny.fasta.gff3`)
    assert.ok(p.stdout.includes('tiny.fasta.gff3'))
  })

  globalThis.itName('Add assembly large input', () => {
    writeFileSync('test_data/tmp.fa', '>chr1\n')
    const stream = createWriteStream('test_data/tmp.fa', { flags: 'a' })
    for (let i = 0; i < 10000; i++) {
      stream.write('CATTGTTGCGGAGTTGAACAACGGCATTAGGAACACTTCCGTCTC\n')
    }
    stream.close()

    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tmp.fa -a test -e -f`,
      true,
      60000,
    )

    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tmp.fa -a test -f`,
      false,
      60000,
    )
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tmp.fa -a test -e -f`,
      true,
      60000,
    )

    unlinkSync('test_data/tmp.fa')
  })

  globalThis.itName('FIXME Checks are triggered and resolved', () => {
    new shell(`${apollo} assembly add-from-gff ${P} test_data/checks.gff -f`)
    // Get the ID of the CDS
    let p = new shell(`${apollo} feature get ${P} -a checks.gff`)
    const out = JSON.parse(p.stdout)
    const gene = out.filter(
      (x) => JSON.stringify(x.attributes.gff_id) === JSON.stringify(['gene01']),
    ) // [x for x in out if x["attributes"]["gff_id"] == ["gene01"]][0]
    const mrna = Object.values(gene.at(0).children).at(0) // list(gene["children"].values())[0]
    const cds_id = Object.values(mrna.children)
      .filter((x) => x.attributes.gff_id.at(0) === 'cds01')
      .at(0)._id

    /*
        cds_id = [
            x
            for x in list(mrna["children"].values())
            if x["attributes"]["gff_id"] == ["cds01"]
        ][0]["_id"]

        p = shell(f"{apollo} feature check {P} -a checks.gff")
        self.assertEqual(0, len(json.loads(p.stdout)))  # No failing check

        # Introduce problems
        shell(f"{apollo} feature edit-coords {P} -i {cds_id} --start 4 --end 24")
        p = shell(f"{apollo} feature check {P} -a checks.gff")
        checks = json.loads(p.stdout)
        # FIXME: There should be 2 failing checks, not 3
        self.assertEqual(3, len(checks))
        self.assertTrue("InternalStopCodonCheck" in p.stdout)
        self.assertTrue("MissingStopCodonCheck" in p.stdout)

        # Problems fixed
        shell(f"{apollo} feature edit-coords {P} -i {cds_id} --start 16 --end 27")
        p = shell(f"{apollo} feature check {P} -a checks.gff")
        checks = json.loads(p.stdout)
        self.assertEqual(0, len(checks))
        */
  })
})
