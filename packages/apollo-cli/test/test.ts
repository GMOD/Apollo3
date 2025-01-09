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
import { before, describe } from 'node:test'
import { shell } from './utils'
import fs from 'node:fs'
import * as crypto from 'crypto'

const apollo = 'yarn dev'
const P = '--profile testAdmin'

describe('Test CLI', () => {
  before(() => {
    new shell(`${apollo} config ${P} address http://localhost:3999`)
    new shell(`${apollo} config ${P} accessType root`)
    new shell(`${apollo} config ${P} rootPassword pass`)
    new shell(`${apollo} login ${P} -f`)
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
    fs.unlinkSync('test_data/tmp.json')

    // From text file, one name or id per line
    fs.writeFileSync('test_data/tmp.txt', 'v1 \n v2 \r\n v3 \n')
    p = new shell(`${apollo} assembly get ${P} -a test_data/tmp.txt`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 3)
    fs.unlinkSync('test_data/tmp.txt')

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
    fs.writeFileSync('test_data/tmp.fa', '>chr1\n')
    const stream = fs.createWriteStream('test_data/tmp.fa', { flags: 'a' })
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

    fs.unlinkSync('test_data/tmp.fa')
  })

  globalThis.itName('FIXME Checks are triggered and resolved', () => {
    new shell(`${apollo} assembly add-from-gff ${P} test_data/checks.gff -f`)
    let p = new shell(`${apollo} feature get ${P} -a checks.gff`)
    const out = JSON.parse(p.stdout)

    p = new shell(`${apollo} feature check ${P} -a checks.gff`)
    assert.deepStrictEqual(p.stdout.trim(), '[]') // No failing check

    // Get the ID of the CDS. We need need it to modify the CDS coordinates
    const gene = out.filter(
      (x: any) =>
        JSON.stringify(x.attributes.gff_id) === JSON.stringify(['gene01']),
    )
    const mrna = Object.values(gene.at(0).children).at(0) as any
    const cds = Object.values(mrna.children)
      .filter((x: any) => x.attributes.gff_id.at(0) === 'cds01')
      .at(0) as any
    const cds_id = cds._id

    // Introduce problems
    new shell(
      `${apollo} feature edit-coords ${P} -i ${cds_id} --start 4 --end 24`,
    )
    p = new shell(`${apollo} feature check ${P} -a checks.gff`)
    let checks = JSON.parse(p.stdout)
    // FIXME: There should be 2 failing checks, not 3
    assert.strictEqual(checks.length, 3)
    assert.ok(p.stdout.includes('InternalStopCodonCheck'))
    assert.ok(p.stdout.includes('MissingStopCodonCheck'))

    // Problems fixed
    new shell(
      `${apollo} feature edit-coords ${P} -i ${cds_id} --start 16 --end 27`,
    )
    p = new shell(`${apollo} feature check ${P} -a checks.gff`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')
  })

  globalThis.itName('Add assembly from local fasta', () => {
    let p = new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv1 -e -f`,
    )
    const out = JSON.parse(p.stdout)
    assert.ok(Object.keys(out.fileIds).includes('fa'))

    p = new shell(`${apollo} assembly get ${P} -a vv1`)
    assert.ok(p.stdout.includes('vv1'))
    p = new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv1 -e`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('Error: Assembly "vv1" already exists'))

    p = new shell(
      `${apollo} assembly add-from-fasta ${P} na.fa -a vv1 -e -f`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('Input'))

    // Test default name
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -e -f`,
    )
    p = new shell(`${apollo} assembly get ${P} -a tiny.fasta`)
    assert.ok(p.stdout.includes('tiny.fasta'))
  })

  globalThis.itName('Add assembly from external fasta', () => {
    // You can also use https://raw.githubusercontent.com/GMOD/Apollo3/refs/heads/main/packages/apollo-cli/test_data/tiny.fasta.gz
    let p = new shell(
      `${apollo} assembly add-from-fasta ${P} -a vv1 -f http://localhost:3131/volvox.fa.gz`,
    )
    const out = JSON.parse(p.stdout)
    assert.ok(Object.keys(out.externalLocation).includes('fa'))

    p = new shell(`${apollo} assembly get ${P} -a vv1`)
    assert.ok(p.stdout.includes('vv1'))

    p = new shell(`${apollo} assembly sequence ${P} -a vv1 -r ctgA -s 1 -e 10`)
    const seq = p.stdout.trim().split('\n')
    assert.strictEqual(seq[1], 'cattgttgcg')

    p = new shell(
      `${apollo} assembly add-from-fasta ${P} -a vv1 -f https://x.fa.gz --fai https://x.fa.gz.fai --gzi https://x.fa.gz.gzi`,
      false,
    )
    assert.ok(p.returncode != 0)
  })

  globalThis.itName('Edit feature from json', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    let p = new shell(`${apollo} feature search ${P} -a vv1 -t BAC`)
    let out = JSON.parse(p.stdout).at(0)
    assert.strictEqual(out.type, 'BAC')

    p = new shell(`${apollo} assembly get ${P} -a vv1`)
    const asm_id = JSON.parse(p.stdout).at(0)._id

    const req = [
      {
        typeName: 'TypeChange',
        changedIds: [out['_id']],
        assembly: asm_id,
        featureId: out['_id'],
        oldType: 'BAC',
        newType: 'G_quartet',
      },
    ]
    const j = JSON.stringify(req)
    new shell(`echo '${j}' | ${apollo} feature edit ${P} -j -`)
    p = new shell(`${apollo} feature search ${P} -a vv1 -t G_quartet`)
    out = JSON.parse(p.stdout).at(0)
    assert.strictEqual(out['type'], 'G_quartet')
  })

  globalThis.itName('Edit feature type', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )

    // Get id of assembly named vv1
    let p = new shell(`${apollo} assembly get ${P} -a vv1`)
    const asm_id = JSON.parse(p.stdout).at(0)._id

    // Get refseqs in assembly vv1
    p = new shell(
      `${apollo} refseq get ${P} | jq '.[] | select(.assembly == "${asm_id}" and .name == "ctgA") | ._id'`,
    )
    const refseq = p.stdout.trim()

    // Get feature in vv1
    p = new shell(`${apollo} feature get ${P} -r ${refseq}`)
    const features = JSON.parse(p.stdout)
    assert.ok(features.length > 2)

    // Get id of feature of type contig
    let contig = features.filter((x: any) => x.type === 'contig')
    assert.strictEqual(contig.length, 1)
    const contig_id = contig.at(0)._id

    // Edit type of "contig" feature
    p = new shell(`${apollo} feature edit-type ${P} -i ${contig_id} -t region`)

    p = new shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(._id == "${contig_id}")'`,
    )
    contig = JSON.parse(p.stdout)
    assert.deepStrictEqual(contig.type, 'region')

    // Return current type
    p = new shell(`${apollo} feature edit-type ${P} -i ${contig_id}`)
    assert.deepStrictEqual(p.stdout.trim(), 'region')
  })

  globalThis.itName('Edit feature coords', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )

    // Get id of assembly named vv1
    let p = new shell(`${apollo} assembly get ${P} -a vv1`)
    const asm_id = JSON.parse(p.stdout).at(0)._id

    // Get refseqs in assembly vv1
    p = new shell(
      `${apollo} refseq get ${P} | jq '.[] | select(.assembly == "${asm_id}" and .name == "ctgA") | ._id'`,
    )
    const refseq = p.stdout.trim()

    // Get feature in vv1
    p = new shell(`${apollo} feature get ${P} -r ${refseq}`)
    const features = JSON.parse(p.stdout)
    assert.ok(features.length > 2)

    // Get id of feature of type contig
    let contig = features.filter((x: any) => x.type === 'contig')
    assert.strictEqual(contig.length, 1)
    const contig_id = contig.at(0)._id

    // Edit start and end coordinates
    new shell(`${apollo} feature edit-coords ${P} -i ${contig_id} -s 80 -e 160`)
    new shell(`${apollo} feature edit-coords ${P} -i ${contig_id} -s 20 -e 100`)

    p = new shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(._id == "${contig_id}")'`,
    )
    contig = JSON.parse(p.stdout)
    assert.strictEqual(contig.min, 20 - 1)
    assert.strictEqual(contig.max, 100)

    p = new shell(
      `${apollo} feature edit-coords ${P} -i ${contig_id} -s 1 -e 1`,
    )
    p = new shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(._id == "${contig_id}")'`,
    )
    contig = JSON.parse(p.stdout)
    assert.strictEqual(contig.min, 0)
    assert.strictEqual(contig.max, 1)

    p = new shell(
      `${apollo} feature edit-coords ${P} -i ${contig_id} -s 0`,
      false,
    )
    assert.strictEqual(p.returncode, 2)
    assert.ok(p.stderr.includes('Coordinates must be greater than 0'))

    p = new shell(
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
    const eden_gene = features
      .filter(
        (x) => x.type === 'gene' && x.attributes.gff_name.at(0) === 'EDEN',
      )
      .at(0) as any
    assert.ok(eden_gene)
    const mrna_id = Object.keys(eden_gene.children).at(0)
    p = new shell(
      `${apollo} feature edit-coords ${P} -i ${mrna_id} -s 1`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('exceeds the bounds of its parent'))
  })

  globalThis.itName('Edit attributes', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )

    // Get id of assembly named vv1
    let p = new shell(`${apollo} assembly get ${P} -a vv1`)
    const asm_id = JSON.parse(p.stdout).at(0)._id

    p = new shell(
      `${apollo} refseq get ${P} | jq '.[] | select(.assembly == "${asm_id}" and .name == "ctgA") | ._id'`,
    )
    const refseq = p.stdout.trim()

    // Get feature in vv1
    p = new shell(
      `${apollo} feature get ${P} -r ${refseq} | jq '.[] | select(.type == "contig") | ._id'`,
    )
    const fid = p.stdout.trim()

    // Edit existing attribute value
    p = new shell(
      `${apollo} feature edit-attribute ${P} -i $${fid} -a source -v 'Eggs & Stuff'`,
    )
    p = new shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a source`)
    let out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out.at(0), `Eggs & Stuff`)

    // Add attribute
    new shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -v stuff`,
    )
    p = new shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr`)
    assert.ok(p.stdout.includes('stuf'))

    // Non existing attr
    p = new shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a NonExist`)
    assert.deepStrictEqual(p.stdout.trim(), '')

    // List of values
    p = new shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -v A B C`,
    )
    p = new shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out, ['A', 'B', 'C'])

    // Delete attribute
    new shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -d`)
    p = new shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr`)
    assert.deepStrictEqual(p.stdout.trim(), '')
    // Delete again is ok
    new shell(`${apollo} feature edit-attribute ${P} -i ${fid} -a newAttr -d`)

    // Special fields
    p = new shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a 'Gene Ontology' -v GO:0051728 GO:0019090`,
    )
    p = new shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a 'Gene Ontology'`,
    )
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out, ['GO:0051728', 'GO:0019090'])

    // This should fail
    p = new shell(
      `${apollo} feature edit-attribute ${P} -i ${fid} -a 'Gene Ontology' -v FOOBAR`,
    )
  })

  globalThis.itName('Search features', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv2 -f`,
    )

    let p = new shell(`${apollo} feature search ${P} -a vv1 vv2 -t EDEN`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
    assert.ok(p.stdout.includes('EDEN'))

    p = new shell(`${apollo} feature search ${P} -t EDEN`)
    out = JSON.parse(p.stdout)
    assert.ok(out.length >= 2)

    p = new shell(`${apollo} feature search ${P} -a vv1 -t EDEN`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.ok(p.stdout.includes('EDEN'))

    p = new shell(`${apollo} feature search ${P} -a foobar -t EDEN`)
    assert.strictEqual('[]', p.stdout.trim())
    assert.ok(p.stderr.includes('Warning'))

    p = new shell(`${apollo} feature search ${P} -a vv1 -t foobarspam`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // It searches attributes values, not attribute names
    p = new shell(`${apollo} feature search ${P} -a vv1 -t multivalue`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // Search feature type
    p = new shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    assert.ok(p.stdout.includes('"type": "contig"'))

    // Search source (which in fact is an attribute)
    p = new shell(`${apollo} feature search ${P} -a vv1 -t someExample`)
    assert.ok(p.stdout.includes('SomeContig'))

    // Case insensitive
    p = new shell(`${apollo} feature search ${P} -a vv1 -t SOMEexample`)
    assert.ok(p.stdout.includes('SomeContig'))

    // No partial word match
    p = new shell(`${apollo} feature search ${P} -a vv1 -t Fingerpri`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // Match full word not necessarily full value
    p = new shell(`${apollo} feature search ${P} -a vv1 -t Fingerprinted`)
    assert.ok(p.stdout.includes('Fingerprinted'))

    // Does not search contig names (reference sequence name)
    p = new shell(`${apollo} feature search ${P} -a vv1 -t ctgB`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // Does not match common words (?) ...
    p = new shell(`${apollo} feature search ${P} -a vv1 -t with`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    // ...But "fake" is ok
    p = new shell(`${apollo} feature search ${P} -a vv1 -t fake`)
    assert.ok(p.stdout.includes('FakeSNP1'))

    // ...or a single unusual letter
    p = new shell(`${apollo} feature search ${P} -a vv1 -t Q`)
    assert.ok(p.stdout.includes('"Q"'))
  })

  globalThis.itName('Delete features', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    let p = new shell(`${apollo} feature search ${P} -a vv1 -t EDEN`)
    const fid = JSON.parse(p.stdout).at(0)._id

    p = new shell(`${apollo} feature delete ${P} -i ${fid} --dry-run`)
    assert.ok(p.stdout.includes(fid))

    new shell(`${apollo} feature delete ${P} -i ${fid}`)
    p = new shell(`${apollo} feature search ${P} -a vv1 -t EDEN`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    p = new shell(`${apollo} feature delete ${P} -i ${fid}`, false)
    assert.strictEqual(p.returncode, 1)
    assert.ok(
      p.stderr.includes('The following featureId was not found in database'),
    )

    p = new shell(`${apollo} feature delete ${P} --force -i ${fid}`)
    assert.strictEqual(p.returncode, 0)
  })

  globalThis.itName('Add child features', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a vv1 -f`,
    )
    let p = new shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    const fid = JSON.parse(p.stdout).at(0)._id

    new shell(
      `${apollo} feature add-child ${P} -i ${fid} -s 10 -e 20 -t contig_read`,
    )
    p = new shell(`${apollo} feature search ${P} -a vv1 -t contig_read`)
    assert.ok(p.stdout.includes('contig_read'))
    assert.ok(p.stdout.includes('"min": 9'))
    assert.ok(p.stdout.includes('"max": 20'))

    p = new shell(
      `${apollo} feature add-child ${P} -i ${fid} -s 10 -e 2000 -t contig_read`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('Child feature coordinates'))

    // Should this fail?
    p = new shell(
      `${apollo} feature add-child ${P} -i ${fid} -s 10 -e 20 -t FOOBAR`,
      false,
    )
    assert.strictEqual(p.returncode, 0)
  })

  globalThis.itName('Import features', () => {
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a vv1 -e -f`,
    )
    new shell(`${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`)
    let p = new shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    // Import again: Add to existing feature
    p = new shell(
      `${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv1`,
    )
    p = new shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 4)

    // Import again: delete ${P} existing
    p = new shell(
      `${apollo} feature import ${P} -d test_data/tiny.fasta.gff3 -a vv1`,
    )
    p = new shell(`${apollo} feature search ${P} -a vv1 -t contig`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    p = new shell(`${apollo} assembly delete ${P} -a vv2`)
    p = new shell(
      `${apollo} feature import ${P} test_data/tiny.fasta.gff3 -a vv2`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('Assembly "vv2" does not exist'))

    p = new shell(`${apollo} feature import ${P} foo.gff3 -a vv1`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('File "foo.gff3" does not exist'))
  })

  globalThis.itName('Copy feature', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a source -f`,
    )
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a dest -e -f`,
    )
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a dest2 -e -f`,
    )
    let p = new shell(`${apollo} feature search ${P} -a source -t contig`)
    const fid = JSON.parse(p.stdout).at(0)._id

    new shell(`${apollo} feature copy ${P} -i ${fid} -r ctgA -a dest -s 1`)
    p = new shell(`${apollo} feature search ${P} -a dest -t contig`)
    let out = JSON.parse(p.stdout)[0]
    assert.strictEqual(out.min, 0)
    assert.strictEqual(out.max, 50)

    // RefSeq id does not need assembly
    p = new shell(`${apollo} refseq get ${P} -a dest2`)
    const destRefSeq = JSON.parse(p.stdout)
      .filter((x: any) => x.name === 'ctgA')
      .at(0)._id

    p = new shell(`${apollo} feature copy ${P} -i ${fid} -r ${destRefSeq} -s 2`)
    p = new shell(`${apollo} feature search ${P} -a dest2 -t contig`)
    out = JSON.parse(p.stdout)[0]
    assert.strictEqual(out['min'], 1)
    assert.strictEqual(out['max'], 51)

    // Copy to same assembly
    new shell(`${apollo} feature copy ${P} -i ${fid} -r ctgA -a source -s 10`)
    p = new shell(`${apollo} feature search ${P} -a source -t contig`)
    out = JSON.parse(p.stdout)

    // Copy non-existant feature or refseq
    p = new shell(
      `${apollo} feature copy ${P} -i FOOBAR -r ctgA -a dest -s 1`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('ERROR'))

    p = new shell(
      `${apollo} feature copy ${P} -i ${fid} -r FOOBAR -a dest -s 1`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('No reference'))

    // Ambiguous refseq
    p = new shell(`${apollo} feature copy ${P} -i ${fid} -r ctgA -s 1`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('more than one'))
  })

  globalThis.itName('Get changes', () => {
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a myAssembly -e -f`,
    )
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a yourAssembly -e -f`,
    )
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a ourAssembly -e -f`,
    )

    let p = new shell(`${apollo} change get ${P}`)
    JSON.parse(p.stdout)
    assert.ok(p.stdout.includes('myAssembly'))
    assert.ok(p.stdout.includes('yourAssembly'))

    p = new shell(`${apollo} change get ${P} -a myAssembly ourAssembly`)
    assert.ok(p.stdout.includes('myAssembly'))
    assert.ok(p.stdout.includes('ourAssembly'))
    assert.ok(p.stdout.includes('yourAssembly') == false)

    // Delete assemblies and get changes by assembly name: Nothing is
    // returned because the assemblies collection doesn't contain that name
    // anymore. Ideally you should still be able to get changes by name?
    new shell(
      `${apollo} assembly delete ${P} -a myAssembly yourAssembly ourAssembly`,
    )
    p = new shell(`${apollo} change get ${P} -a myAssembly`)
    const out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)
  })

  globalThis.itName('Get sequence', () => {
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a v1 -e -f`,
    )
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta -a v2 -e -f`,
    )

    let p = new shell(`${apollo} assembly sequence ${P} -a nonExistant`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('returned 0 assemblies'))

    p = new shell(`${apollo} assembly sequence ${P} -a v1 -s 0`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('must be greater than 0'))

    p = new shell(`${apollo} assembly sequence ${P} -a v1`)
    let seq = p.stdout.trim().split('\n')
    assert.strictEqual(seq.length, 25)
    assert.deepStrictEqual(seq.at(0), '>ctgA:1..420')
    assert.deepStrictEqual(
      seq.at(1),
      'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcct',
    )
    assert.deepStrictEqual(seq.at(6), 'ttggtcgctccgttgtaccc')
    assert.deepStrictEqual(seq.at(7), '>ctgB:1..800')
    assert.deepStrictEqual(seq.at(-1), 'ttggtcgctccgttgtaccc')

    p = new shell(`${apollo} assembly sequence ${P} -a v1 -r ctgB -s 1 -e 1`)
    seq = p.stdout.split('\n')
    assert.deepStrictEqual(seq.at(0), '>ctgB:1..1')
    assert.deepStrictEqual(seq.at(1), 'A')

    p = new shell(`${apollo} assembly sequence ${P} -a v1 -r ctgB -s 2 -e 4`)
    seq = p.stdout.split('\n')
    assert.deepStrictEqual(seq.at(0), '>ctgB:2..4')
    assert.deepStrictEqual(seq.at(1), 'CAT')

    p = new shell(`${apollo} assembly sequence ${P} -r ctgB`, false)
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('found in more than one'))
  })

  globalThis.itName('Get feature by id', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v1 -f`,
    )
    let p = new shell(`${apollo} feature get ${P} -a v1`)
    const ff = JSON.parse(p.stdout)

    const x1 = ff.at(0)._id
    const x2 = ff.at(1)._id
    p = new shell(`${apollo} feature get-id ${P} -i ${x1} ${x1} ${x2}`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
    assert.deepStrictEqual(out.at(0)._id, x1)
    assert.deepStrictEqual(out.at(1)._id, x2)

    p = new shell(`${apollo} feature get-id ${P} -i FOOBAR`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')

    p = new shell(`echo -e '${x1} \n ${x2}' | ${apollo} feature get-id ${P}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)
  })

  globalThis.itName('Assembly checks', () => {
    // TODO: Improve tests once more checks exist (currently there is only
    // CDSCheck)
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v1 -f`,
    )

    // Test view available check type
    let p = new shell(`${apollo} assembly check ${P}`)
    let out = JSON.parse(p.stdout)
    assert.ok(p.stdout.includes('CDSCheck'))
    const cdsCheckId = out.filter((x: any) => x.name === 'CDSCheck').at(0)._id

    // Test view checks set for assembly
    p = new shell(`${apollo} assembly check ${P} -a v1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)

    // Test non-existant assembly
    p = new shell(`${apollo} assembly check ${P} -a non-existant`, false)
    assert.strictEqual(p.returncode, 1)
    assert.ok(p.stderr.includes('non-existant'))

    // Test non-existant check
    p = new shell(`${apollo} assembly check ${P} -a v1 -c not-a-check`, false)
    assert.strictEqual(p.returncode, 1)
    assert.ok(p.stderr.includes('not-a-check'))

    // Test add checks. Test check is added as opposed to replacing current
    // checks with input list
    new shell(`${apollo} assembly check ${P} -a v1 -c CDSCheck CDSCheck`)
    p = new shell(`${apollo} assembly check ${P} -a v1`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.deepStrictEqual(out.at(0).name, 'CDSCheck')

    // Works also with check id
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v2 -f`,
    )
    new shell(`${apollo} assembly check ${P} -a v2 -c ${cdsCheckId}`)
    p = new shell(`${apollo} assembly check ${P} -a v2`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)
    assert.deepStrictEqual(out.at(0).name, 'CDSCheck')

    // Delete check
    new shell(`${apollo} assembly check ${P} -a v1 -d -c CDSCheck`)
    p = new shell(`${apollo} assembly check ${P} -a v1`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(p.stdout.trim(), '[]')
  })

  globalThis.itName('Feature checks', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a v1 -f`,
    )
    new shell(`${apollo} assembly check ${P} -a v1 -c CDSCheck`)
    let p = new shell(`${apollo} feature check ${P} -a v1`)
    const out = JSON.parse(p.stdout)
    assert.ok(out.length > 1)
    assert.ok(p.stdout.includes('InternalStopCodonCheck'))

    // Ids with checks
    const ids: string[] = out.map((x: any) => x.ids)
    assert.ok(new Set(ids).size > 1)

    // Retrieve by feature id
    const xid = [...ids].join(' ')
    p = new shell(`${apollo} feature check ${P} -i ${xid}`)
    assert.ok(p.stdout.includes('InternalStopCodonCheck'))
  })

  globalThis.itName('Feature checks indexed', () => {
    new shell(
      `${apollo} assembly add-from-fasta ${P} -a v1 test_data/tiny.fasta.gz -f`,
    )
    new shell(`${apollo} assembly check ${P} -a v1 -c CDSCheck`)
    new shell(
      `${apollo} feature import ${P} -a v1 test_data/tiny.fasta.gff3 -d`,
    )
    let p = new shell(`${apollo} feature check ${P} -a v1`)
    const out = JSON.parse(p.stdout)
    assert.ok(out.length > 1)
    assert.ok(p.stdout.includes('InternalStopCodonCheck'))

    // Ids with checks
    const ids: string[] = out.map((x: any) => x.ids)
    assert.ok(new Set(ids).size > 1)

    // Retrieve by feature id
    const xid = [...ids].join(' ')
    p = new shell(`${apollo} feature check ${P} -i ${xid}`)
    assert.ok(p.stdout.includes('InternalStopCodonCheck'))
  })

  globalThis.itName('User', () => {
    let p = new shell(`${apollo} user get ${P}`)
    let out = JSON.parse(p.stdout)
    assert.ok(out.length > 0)

    p = new shell(`${apollo} user get ${P} -r admin`)
    const out2 = JSON.parse(p.stdout)
    assert.ok(out.length > 0)
    assert.ok(out.length > out2.length)

    p = new shell(`${apollo} user get ${P} -r admin -u root`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)

    p = new shell(`${apollo} user get ${P} -r readOnly -u root`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)
  })

  globalThis.itName('Apollo profile env', () => {
    let p = new shell(
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

  globalThis.itName('Apollo config create env', () => {
    let p = new shell(
      `\
            export APOLLO_DISABLE_CONFIG_CREATE=1
            rm -f tmp.yml
            ${apollo} config --config-file tmp.yml address http://localhost:3999`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('does not exist yet'))
    assert.ok(fs.existsSync('tmp.yml') == false)

    p = new shell(
      `\
            export APOLLO_DISABLE_CONFIG_CREATE=0
            rm -f tmp.yml
            ${apollo} config --config-file tmp.yml address http://localhost:3999`,
    )
    assert.strictEqual(0, p.returncode)
    assert.ok(fs.existsSync('tmp.yml'))

    p = new shell(
      `\
            unset APOLLO_DISABLE_CONFIG_CREATE
            rm -f tmp.yml
            ${apollo} config --config-file tmp.yml address http://localhost:3999`,
    )
    assert.strictEqual(0, p.returncode)
    assert.ok(fs.existsSync('tmp.yml'))

    fs.unlinkSync('tmp.yml')
  })

  globalThis.itName('Invalid access', () => {
    let p = new shell(`${apollo} user get --profile foo`, false)
    assert.strictEqual(1, p.returncode)
    assert.ok(p.stderr.includes('Profile "foo" does not exist'))
  })

  globalThis.itName('Refname alias configuration', () => {
    new shell(
      `${apollo} assembly add-from-gff ${P} test_data/tiny.fasta.gff3 -a asm1 -f`,
    )

    let p = new shell(`${apollo} assembly get ${P} -a asm1`)
    assert.ok(p.stdout.includes('asm1'))
    assert.ok(p.stdout.includes('asm2') == false)
    const asm_id = JSON.parse(p.stdout)[0]['_id']

    p = new shell(
      `${apollo} refseq add-alias ${P} test_data/alias.txt -a asm2`,
      false,
    )
    assert.ok(p.stderr.includes('Assembly asm2 not found'))

    p = new shell(
      `${apollo} refseq add-alias ${P} test_data/alias.txt -a asm1`,
      false,
    )
    assert.ok(
      p.stdout.includes(
        'Reference name aliases added successfully to assembly asm1',
      ),
    )

    p = new shell(`${apollo} refseq get ${P}`)
    const refseq = JSON.parse(p.stdout.trim())
    const vv1ref = refseq.filter((x: any) => x.assembly === asm_id)
    const refname_aliases: Record<string, string[]> = {}
    for (const x of vv1ref) {
      refname_aliases[x.name] = x.aliases
    }
    assert.deepStrictEqual(
      JSON.stringify(refname_aliases['ctgA'].sort()),
      JSON.stringify(['ctga', 'CTGA'].sort()),
    )
    assert.deepStrictEqual(
      JSON.stringify(refname_aliases['ctgB'].sort()),
      JSON.stringify(['ctgb', 'CTGB'].sort()),
    )
    assert.deepStrictEqual(
      JSON.stringify(refname_aliases['ctgC'].sort()),
      JSON.stringify(['ctgc', 'CTGC'].sort()),
    )
  })

  // Works locally but fails on github
  globalThis.itName('Login', () => {
    // This should wait for user's input
    let p = new shell(`${apollo} login ${P}`, false, 5000)
    assert.ok(p.returncode != 0)
    // This should be ok
    new shell(`${apollo} login ${P} --force`, true, 5000)
  })

  globalThis.itName('File upload', () => {
    let p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    let out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out.type, 'text/x-fasta')
    assert.ok(out._id)

    p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out.type, 'text/x-fasta')

    p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta.gff3`)
    out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out.type, 'text/x-gff3')

    p = new shell(`${apollo} file upload ${P} test_data/guest.yaml`, false)
    assert.ok(p.returncode != 0)

    p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta.gz`, false)
    assert.ok(p.stderr.includes('it may be gzip or bgzip compressed'))
    assert.ok(p.returncode != 0)
  })

  globalThis.itName('File upload gzip', () => {
    // Uploading a gzip file must skip compression and just copy the file
    const gz = fs.readFileSync('test_data/tiny.fasta.gz')
    const md5 = crypto.createHash('md5').update(gz).digest('hex')

    const p = new shell(
      `${apollo} file upload ${P} test_data/tiny.fasta.gz -t text/x-fasta`,
    )
    const out = JSON.parse(p.stdout)
    assert.strictEqual(out.checksum, md5)
    new shell(`${apollo} assembly add-from-fasta ${P} -e -f ${out._id}`)
  })

  globalThis.itName('Add assembly gzip', () => {
    // Autodetect format
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tiny.fasta.gz -e -f -a vv1`,
    )
    let p = new shell(`${apollo} assembly sequence ${P} -a vv1`)
    assert.ok(p.stdout.startsWith('>'))
    assert.ok(p.stdout.includes('cattgttgcggagttgaaca'))

    // Skip autodetect
    fs.copyFileSync('test_data/tiny.fasta', 'test_data/tmp.gz')
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/tmp.gz -e -f -a vv1 --decompressed`,
    )
    p = new shell(`${apollo} assembly sequence ${P} -a vv1`)
    assert.ok(p.stdout.startsWith('>'))
    assert.ok(p.stdout.includes('cattgttgcggagttgaaca'))
    fs.unlinkSync('test_data/tmp.gz')

    fs.copyFileSync('test_data/tiny.fasta.gz', 'test_data/fasta.tmp')
    new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/fasta.tmp -e -f -a vv1 --gzip`,
    )
    p = new shell(`${apollo} assembly sequence ${P} -a vv1`)
    assert.ok(p.stdout.startsWith('>'))
    assert.ok(p.stdout.includes('cattgttgcggagttgaaca'))

    // Autodetect false positive
    p = new shell(
      `${apollo} assembly add-from-fasta ${P} test_data/fasta.tmp -e -f -a vv1`,
      false,
    )
    assert.ok(p.returncode != 0)
    fs.unlinkSync('test_data/fasta.tmp')
  })

  globalThis.itName('Add assembly from files not editable', () => {
    // It would be good to check that really there was no sequence loading
    new shell(
      `${apollo} assembly add-from-fasta ${P} -f test_data/tiny.fasta.gz`,
    )
    let p = new shell(`${apollo} assembly sequence ${P} -a tiny.fasta.gz`)
    assert.ok(p.stdout.startsWith('>'))
    assert.ok(p.stdout.includes('cattgttgcggagttgaaca'))

    p = new shell(
      `${apollo} assembly add-from-fasta ${P} -f test_data/tiny.fasta`,
      false,
    )
    assert.ok(p.returncode != 0)

    // Setting --gzi & --fai
    new shell(
      `${apollo} assembly add-from-fasta ${P} -f test_data/tiny2.fasta.gz --gzi test_data/tiny.fasta.gz.gzi --fai test_data/tiny.fasta.gz.fai`,
    )
    p = new shell(`${apollo} assembly sequence ${P} -a tiny2.fasta.gz`)
    assert.ok(p.stdout.startsWith('>'))
    assert.ok(p.stdout.includes('cattgttgcggagttgaaca'))
  })

  globalThis.itName('Add assembly from file ids not editable', () => {
    // Upload and get Ids for: bgzip fasta, fai and gzi
    let p = new shell(
      `${apollo} file upload ${P} test_data/tiny.fasta.gz -t application/x-bgzip-fasta`,
    )
    const fastaId = JSON.parse(p.stdout)._id

    p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta.gz.fai`)
    const faiId = JSON.parse(p.stdout)._id

    p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta.gz.gzi`)
    const gziId = JSON.parse(p.stdout)._id

    new shell(
      `${apollo} assembly add-from-fasta ${P} -f ${fastaId} --fai test_data/tiny.fasta.gz.fai --gzi test_data/tiny.fasta.gz.gzi`,
    )
    p = new shell(`${apollo} assembly sequence ${P} -a ${fastaId}`)
    assert.ok(p.stdout.startsWith('>'))
    assert.ok(p.stdout.includes('cattgttgcggagttgaaca'))

    new shell(
      `${apollo} assembly add-from-fasta ${P} -f ${fastaId} --fai ${faiId} --gzi ${gziId}`,
    )
    p = new shell(`${apollo} assembly sequence ${P} -a ${fastaId}`)
    assert.ok(p.stdout.startsWith('>'))
  })

  globalThis.itName('Add assembly from file id', () => {
    let p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const fid = JSON.parse(p.stdout)._id
    p = new shell(`${apollo} assembly add-from-fasta ${P} ${fid} -a up -e -f`)
    const out = JSON.parse(p.stdout)
    assert.deepStrictEqual(out.name, 'up')
    assert.deepStrictEqual(out.fileIds.fa, fid)
  })

  globalThis.itName('Get files', () => {
    new shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    let p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const fid = JSON.parse(p.stdout)._id

    p = new shell(`${apollo} file get ${P}`)
    let out = JSON.parse(p.stdout)
    assert.ok(out.length >= 2)
    assert.ok(out.filter((x) => x._id === fid))

    p = new shell(`${apollo} file get ${P} -i ${fid} ${fid}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 1)

    p = new shell(`${apollo} file get ${P} -i nonexists`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)
  })

  globalThis.itName('Download file', () => {
    let p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const up = JSON.parse(p.stdout)
    if (fs.existsSync(up.basename)) {
      throw new Error(
        `File ${up.basename} exists - if safe to do so, delete it before running this test`,
      )
    }

    new shell(`${apollo} file download ${P} -i ${up._id}`)
    let down = fs.readFileSync(up.basename).toString()
    assert.ok(down.startsWith('>'))
    assert.ok(down.trim().endsWith('accc'))
    fs.unlinkSync(up.basename)

    new shell(`${apollo} file download ${P} -i ${up._id} -o tmp.fa`)
    down = fs.readFileSync('tmp.fa').toString()
    assert.ok(down.startsWith('>'))
    assert.ok(down.trim().endsWith('accc'))
    fs.unlinkSync('tmp.fa')

    p = new shell(`${apollo} file download ${P} -i ${up['_id']} -o -`)
    assert.ok(p.stdout.startsWith('>'))
    assert.ok(p.stdout.trim().endsWith('accc'))
  })

  globalThis.itName('Delete file', () => {
    let p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const up1 = JSON.parse(p.stdout)
    p = new shell(`${apollo} file upload ${P} test_data/tiny.fasta`)
    const up2 = JSON.parse(p.stdout)

    p = new shell(`${apollo} file delete ${P} -i ${up1._id} ${up2._id}`)
    let out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 2)

    p = new shell(`${apollo} file get ${P} -i ${up1._id} ${up2._id}`)
    out = JSON.parse(p.stdout)
    assert.strictEqual(out.length, 0)
  })
})
