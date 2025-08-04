/* eslint-disable @typescript-eslint/no-floating-promises */
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import gff, { type GFF3Feature } from '@gmod/gff'
import { assert, use } from 'chai'
import chaiExclude from 'chai-exclude'

import { gff3ToAnnotationFeature } from './gff3ToAnnotationFeature'

use(chaiExclude)

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
  [
    'a feature with two children',
    `ctgA	est	EST_match	1050	3202	.	+	.	ID=Match1;Name=agt830.5;Target=agt830.5 1 654
ctgA	est	match_part	1050	1500	.	+	.	Parent=Match1;Name=agt830.5;Target=agt830.5 1 451
ctgA	est	match_part	3000	3202	.	+	.	Parent=Match1;Name=agt830.5;Target=agt830.5 452 654
`,
    {
      _id: '66cf9fbb4e947fa2c27d3d6a',
      refSeq: 'ctgA',
      type: 'EST_match',
      min: 1049,
      max: 3202,
      strand: 1,
      children: {
        '66cf9fbb4e947fa2c27d3d68': {
          _id: '66cf9fbb4e947fa2c27d3d68',
          refSeq: 'ctgA',
          type: 'match_part',
          min: 1049,
          max: 1500,
          strand: 1,
          attributes: {
            gff_source: ['est'],
            gff_name: ['agt830.5'],
            gff_target: ['agt830.5 1 451'],
          },
        },
        '66cf9fbb4e947fa2c27d3d69': {
          _id: '66cf9fbb4e947fa2c27d3d69',
          refSeq: 'ctgA',
          type: 'match_part',
          min: 2999,
          max: 3202,
          strand: 1,
          attributes: {
            gff_source: ['est'],
            gff_name: ['agt830.5'],
            gff_target: ['agt830.5 452 654'],
          },
        },
      },
      attributes: {
        gff_source: ['est'],
        gff_id: ['Match1'],
        gff_name: ['agt830.5'],
        gff_target: ['agt830.5 1 654'],
      },
    },
  ],
]

interface AnnotationFeatureSnapshotWithChildrenArray
  extends Omit<AnnotationFeatureSnapshot, 'children'> {
  children?: AnnotationFeatureSnapshotWithChildrenArray[]
}

function childrenToArray(
  feature: AnnotationFeatureSnapshot,
): AnnotationFeatureSnapshotWithChildrenArray {
  const { children } = feature
  if (!children) {
    return feature as AnnotationFeatureSnapshotWithChildrenArray
  }
  const childrenArray = Object.values(children).map((child) =>
    childrenToArray(child),
  )
  return { ...feature, children: childrenArray }
}

function compareFeatures(
  feature1: AnnotationFeatureSnapshot,
  feature2: AnnotationFeatureSnapshot,
) {
  assert.deepEqualExcludingEvery(
    childrenToArray(feature1),
    childrenToArray(feature2),
    '_id',
  )
}

function readFeatureFile(fn: string): GFF3Feature[] {
  const lines = readFileSync(fn).toString().split('\n')
  const feature: string[] = []
  for (const line of lines) {
    if (!line.startsWith('#')) {
      feature.push(line)
    }
  }
  const inGff = gff.parseStringSync(feature.join('\n')) as GFF3Feature[]
  return inGff
}

export function readAnnotationFeatureSnapshot(
  fn: string,
): AnnotationFeatureSnapshot {
  const lines = readFileSync(fn).toString()
  return JSON.parse(lines) as AnnotationFeatureSnapshot
}

const [ex1, , ex2, , ex3, , ex4] = readFeatureFile(
  'test_data/gene_representations.gff3',
)

describe('gff3ToAnnotationFeature examples', () => {
  it('Convert one CDS', () => {
    const actual = gff3ToAnnotationFeature(
      readFeatureFile('test_data/one_cds.gff3')[0],
    )
    const expected = readAnnotationFeatureSnapshot('test_data/one_cds.json')
    compareFeatures(actual, expected)
  })
  it('Convert two CDSs', () => {
    const actual = gff3ToAnnotationFeature(
      readFeatureFile('test_data/two_cds.gff3')[0],
    )
    const expected = readAnnotationFeatureSnapshot('test_data/two_cds.json')
    compareFeatures(actual, expected)
  })
  it('Convert example 1', () => {
    const actual = gff3ToAnnotationFeature(ex1)
    const txt = JSON.stringify(actual, null, 2)

    assert.equal(txt.match(/"type": "CDS"/g)?.length, 4)
    assert.equal(txt.match(/"type": "TF_binding_site"/g)?.length, 1)

    const expected = readAnnotationFeatureSnapshot('test_data/example01.json')
    compareFeatures(actual, expected)
  })
  it('Convert example 2', () => {
    const actual = gff3ToAnnotationFeature(ex2)
    const txt = JSON.stringify(actual, null, 2)
    assert.equal(txt.match(/"type": "CDS"/g)?.length, 4)
    const expected = readAnnotationFeatureSnapshot('test_data/example02.json')
    compareFeatures(actual, expected)
  })
  it('Convert example 3', () => {
    // NB: In example 3 (and in the other examples) mRNA10003 produces two proteins.
    // In the other examples the two proteins are identified by sharing the same cds id.
    // In example 3 instead each cds has a unique id so the two proteins are identified by the order they
    // appear in the gff.
    const actual = gff3ToAnnotationFeature(ex3)
    const txt = JSON.stringify(actual, null, 2)
    assert.equal(txt.match(/"type": "CDS"/g)?.length, 4)

    // const expected = readAnnotationFeatureSnapshot('test_data/example03.json')
    // compareFeatures(actual, expected)
  })
  it('Convert example 4', () => {
    const ft = JSON.stringify(ex4, null, 2)
    assert.equal(ft.match(/"type": "five_prime_UTR"/g)?.length, 6)
    assert.equal(ft.match(/"type": "three_prime_UTR"/g)?.length, 3)

    const actual = gff3ToAnnotationFeature(ex4)
    const txt = JSON.stringify(actual, null, 2)
    assert.equal(txt.match(/"type": "CDS"/g)?.length, 4)
    assert.equal(txt.match(/prime_UTR/g), null)

    const expected = readAnnotationFeatureSnapshot('test_data/example04.json')
    compareFeatures(actual, expected)
  })
  it('Convert braker gff', () => {
    const [gffFeature] = readFeatureFile('test_data/braker.gff')
    const actual = gff3ToAnnotationFeature(gffFeature)
    const txt = JSON.stringify(actual, null, 2)
    assert.equal(txt.match(/intron/g), null)
    assert.equal(txt.match(/_codon/g), null)
  })
})

describe('CDS without exons', () => {
  it('Convert mRNA with CDS but without exon', () => {
    const [gffFeature] = readFeatureFile('test_data/cds_without_exon.gff')
    const actual = gff3ToAnnotationFeature(gffFeature)
    const expected = readAnnotationFeatureSnapshot(
      'test_data/cds_without_exon.json',
    )
    compareFeatures(actual, expected)
  })
  it('Convert mRNA with CDS but without exon and spliced UTR', () => {
    const [gffFeature] = readFeatureFile(
      'test_data/cds_without_exon_spliced_utr.gff',
    )
    const actual = gff3ToAnnotationFeature(gffFeature)
    const expected = readAnnotationFeatureSnapshot(
      'test_data/cds_without_exon_spliced_utr.json',
    )
    compareFeatures(actual, expected)
  })
  it('Convert mRNA with one CDS, without exons non-adjacent UTR', () => {
    const [gffFeature] = readFeatureFile(
      'test_data/onecds_without_exon_spliced_utr.gff',
    )
    const actual = gff3ToAnnotationFeature(gffFeature)
    const expected = readAnnotationFeatureSnapshot(
      'test_data/onecds_without_exon_spliced_utr.json',
    )
    compareFeatures(actual, expected)
  })
})

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
})

describe('Source and score', () => {
  it('Convert score and source', () => {
    const gffFeature: GFF3Feature = [
      {
        seq_id: 'chr1',
        source: 'mySource',
        type: 'gene',
        start: 1000,
        end: 9000,
        score: 0,
        strand: '+',
        phase: null,
        attributes: {
          ID: ['gene10001'],
          Name: ['EDEN'],
          testid: ['t003'],
        },
        child_features: [],
        derived_features: [],
      },
    ]
    const actual = gff3ToAnnotationFeature(gffFeature)
    assert.deepStrictEqual(actual.attributes?.gff_source?.at(0), 'mySource')
    assert.deepStrictEqual(actual.attributes?.gff_score?.at(0), '0')
  })
})
