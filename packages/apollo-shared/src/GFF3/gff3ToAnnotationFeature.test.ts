/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import gff, { GFF3Feature } from '@gmod/gff'

import { readFileSync } from 'node:fs'

import { gff3ToAnnotationFeature } from './gff3ToAnnotationFeature'
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

const testCases: [string, string, AnnotationFeatureSnapshot][] = [
  [
    'a feature with no children',
    'ctgA	example	remark	1000	2000	.	.	.	Name=Remark:hga;Alias=hga\n',
    {
      _id: '66c51f3e002c683eaf98a223',
      refSeq: 'ctgA',
      type: 'remark',
      min: 999,
      max: 2000,
      attributes: {
        gff_source: ['example'],
        gff_name: ['Remark:hga'],
        gff_alias: ['hga'],
      },
    },
  ],
]

function readSingleFeatureFile(fn: string): GFF3Feature {
  const lines = readFileSync(fn).toString().split('\n')
  const feature: string[] = []
  for (const line of lines) {
    if (!line.startsWith('#')) {
      feature.push(line)
    }
  }
  const inGff = gff.parseStringSync(feature.join('\n')) as GFF3Feature[]
  if (inGff.length != 1) {
    throw new Error(`Exactly 1 feature expected in file ${fn}`)
  }
  return inGff[0]
}

function renameIds(x: AnnotationFeatureSnapshot): AnnotationFeatureSnapshot {
  const gene = JSON.parse(JSON.stringify(x))
  if (gene.children) {
    for (const mrnaId of Object.keys(gene.children)) {
      const mrnaNewId = gene.children[mrnaId].attributes?.testid
      if (!mrnaNewId) {
        throw new Error('Expected to find testid')
      }
      const mrna = gene.children[mrnaId]
      gene.children[mrnaNewId] = mrna
      delete gene.children[mrnaId]
      if (mrna.children) {
        for (const exonId of Object.keys(mrna.children)) {
          const exonNewId = mrna.children[exonId].attributes?.testid
          if (!exonNewId) {
            throw new Error('Expected to find testid')
          }
          const exon = gene.children[mrnaNewId].children[exonId]
          gene.children[mrnaNewId].children[exonNewId] = exon
          delete gene.children[mrnaNewId].children[exonId]
          if (exon.children) {
            for (const cdsId of Object.keys(exon.children)) {
              const cdsNewId = exon.children[cdsId].attributes?.testid
              if (!cdsNewId) {
                throw new Error('Expected to find testid')
              }
              const cds =
                gene.children[mrnaNewId].children[exonNewId].children[cdsId]
              gene.children[mrnaNewId].children[exonNewId].children[cdsNewId] =
                cds
              delete gene.children[mrnaNewId].children[exonNewId].children[
                cdsId
              ]
              if (cds.children) {
                for (const subId of Object.keys(cds.children)) {
                  const subNewId = cds.children[subId].attributes?.testid
                  if (!subNewId) {
                    throw new Error('Expected to find testid')
                  }
                  const sub =
                    gene.children[mrnaNewId].children[exonNewId].children[
                      cdsNewId
                    ].children[subId]
                  gene.children[mrnaNewId].children[exonNewId].children[
                    cdsNewId
                  ].children[subNewId] = sub
                  delete gene.children[mrnaNewId].children[exonNewId].children[
                    cdsNewId
                  ].children[subId]
                }
              }
            }
          }
        }
      }
    }
  }
  return gene as AnnotationFeatureSnapshot
}

function compareFeatures(
  feature1: AnnotationFeatureSnapshot,
  feature2: AnnotationFeatureSnapshot,
) {
  const f1 = structuredClone(feature1)
  const f2 = structuredClone(feature2)
  assert.ok(f1.attributes)
  assert.ok(f2.attributes)
  f1.attributes.testid = undefined
  f2.attributes.testid = undefined
  assert.deepEqual({ ...f1, _id: undefined }, { ...f2, _id: undefined })
}

describe('gff3ToAnnotationFeature', () => {
  for (const testCase of testCases) {
    const [description, featureLine, convertedFeature] = testCase
    it(`converts ${description}`, () => {
      const gff3Feature = gff.parseStringSync(featureLine, {
        parseSequences: false,
      })
      const feature = gff3ToAnnotationFeature(gff3Feature[0])
      compareFeatures(convertedFeature, feature)
    })
  }

  it.skip('converts gene with mRNA', () => {
    const expected: AnnotationFeatureSnapshot = {
      _id: '66cc92b3f580b24ed78564b5',
      refSeq: 'ctgA',
      type: 'gene',
      min: 999,
      max: 2000,
      children: {
        '66cc92b3f580b24ed78564b6': {
          _id: '66cc92b3f580b24ed78564b6',
          refSeq: 'ctgA',
          type: 'mRNA',
          min: 999,
          max: 2000,
          attributes: {
            gff_source: ['example'],
            gff_name: ['mrnaA'],
            gff_alias: ['hga'],
          },
        },
      },
      attributes: {
        gff_source: ['example'],
        gff_id: ['gene01'],
        gff_name: ['geneA'],
        gff_alias: ['hga'],
      },
    }

    const feature: GFF3Feature = readSingleFeatureFile(
      'test_data/gene_mrna.gff3',
    )
    const actual = gff3ToAnnotationFeature(feature)
    compareFeatures(actual, expected)
  })

  it.only('converts example', () => {
    const _ex1 = gff3ToAnnotationFeature(
      readSingleFeatureFile('test_data/example01.gff3'),
    )
    console.log(JSON.stringify(_ex1, null, 2))

    const ex1 = renameIds(_ex1)

    const _ex2 = gff3ToAnnotationFeature(
      readSingleFeatureFile('test_data/example02.gff3'),
    )
    const ex2 = renameIds(_ex2)

    const gene1 = structuredClone(ex1)
    gene1.children = undefined
    const gene2 = structuredClone(ex2)
    gene2.children = undefined
    compareFeatures(gene1, gene2)

    assert.ok(ex1.children)
    assert.ok(ex2.children)

    assert.equal(
      JSON.stringify(Object.keys(ex1.children).sort()),
      JSON.stringify(['t004', 't005', 't006', 'x001']),
    )
    assert.equal(
      JSON.stringify(Object.keys(ex2.children).sort()),
      JSON.stringify(['t004', 't005', 't006']),
    )

    const mrna_1 = structuredClone(ex1).children?.t004
    const mrna_2 = structuredClone(ex2).children?.t004

    console.log(JSON.stringify(mrna_1, null, 2))

    assert.ok(mrna_1?.children)
    assert.ok(mrna_2?.children)

    assert.equal(
      Object.keys(mrna_1.children).length,
      Object.keys(mrna_2.children).length,
    )

    compareFeatures(mrna_1.children.t007, mrna_2.children.t007)
    compareFeatures(mrna_1.children.t015, mrna_2.children.t021)
  })
})
