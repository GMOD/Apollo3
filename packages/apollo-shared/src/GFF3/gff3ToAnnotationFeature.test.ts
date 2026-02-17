/* eslint-disable @typescript-eslint/no-floating-promises */
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { type GFF3Feature, parseStringSync } from '@gmod/gff'
import { assert, use } from 'chai'
import chaiExclude from 'chai-exclude'

import { gff3ToAnnotationFeature } from './gff3ToAnnotationFeature.js'
import { readAnnotationFeatureSnapshot, testCases } from './testUtil.js'

use(chaiExclude)

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

describe('Converts GFF3 to AnnotationFeatureSnapshot JSON when', () => {
  for (const testCase of testCases) {
    const { filenameStem, description } = testCase
    it(description, () => {
      const fileText = readFileSync(`test_data/${filenameStem}.gff3`, 'utf8')
      const gffFeatures = parseStringSync(fileText, { parseSequences: false })
      const annotationFeatures = gffFeatures.map((gff3Feature) =>
        gff3ToAnnotationFeature(gff3Feature),
      )
      const annotationFeaturesExpected = JSON.parse(
        readFileSync(`test_data/${filenameStem}.json`, 'utf8'),
      ) as AnnotationFeatureSnapshot[]
      for (const [
        i,
        annotationFeatureExpected,
      ] of annotationFeaturesExpected.entries()) {
        const annotationFeature = annotationFeatures[i]
        compareFeatures(annotationFeature, annotationFeatureExpected)
      }
    })
  }
})

function readFeatureFile(fn: string): GFF3Feature[] {
  const lines = readFileSync(fn).toString().split('\n')
  const feature: string[] = []
  for (const line of lines) {
    if (!line.startsWith('#')) {
      feature.push(line)
    }
  }
  const inGff = parseStringSync(feature.join('\n')) as GFF3Feature[]
  return inGff
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
