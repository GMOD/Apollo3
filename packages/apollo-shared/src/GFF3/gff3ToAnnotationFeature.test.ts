/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'

import gff, { GFF3Feature } from '@gmod/gff'
import { assert, use } from 'chai'
import chaiExclude from 'chai-exclude'

import { gff3ToAnnotationFeature } from './gff3ToAnnotationFeature'
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

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

function readAnnotationFeatureSnapshot(fn: string): AnnotationFeatureSnapshot {
  const lines = readFileSync(fn).toString()
  return JSON.parse(lines) as AnnotationFeatureSnapshot
}

describe('gff3ToAnnotationFeature examples', () => {
  it('Convert one CDS', () => {
    const actual = gff3ToAnnotationFeature(
      readSingleFeatureFile('test_data/one_cds.gff3'),
    )
    const expected = readAnnotationFeatureSnapshot('test_data/one_cds.json')
    compareFeatures(actual, expected)
  })
  it('Convert two CDSs', () => {
    const actual = gff3ToAnnotationFeature(
      readSingleFeatureFile('test_data/two_cds.gff3'),
    )
    const expected = readAnnotationFeatureSnapshot('test_data/two_cds.json')
    compareFeatures(actual, expected)
  })
  it('Convert example 1', () => {
    const actual = gff3ToAnnotationFeature(
      readSingleFeatureFile('test_data/example01.gff3'),
    )
    const expected = readAnnotationFeatureSnapshot('test_data/example01.json')
    compareFeatures(actual, expected)
  })
  it('Convert example 2', () => {
    const actual = gff3ToAnnotationFeature(
      readSingleFeatureFile('test_data/example02.gff3'),
    )
    const expected = readAnnotationFeatureSnapshot('test_data/example02.json')
    compareFeatures(actual, expected)
  })
})

// describe('gff3ToAnnotationFeature', () => {
//   for (const testCase of testCases) {
//     const [description, featureLine, convertedFeature] = testCase
//     it(`converts ${description}`, () => {
//       const gff3Feature = gff.parseStringSync(featureLine, {
//         parseSequences: false,
//       })
//       const feature = gff3ToAnnotationFeature(gff3Feature[0])
//       compareFeatures(convertedFeature, feature)
//     })
//   }
// })
