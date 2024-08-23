/* eslint-disable @typescript-eslint/no-floating-promises */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import gff from '@gmod/gff'

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

function compareFeatures(
  feature1: AnnotationFeatureSnapshot,
  feature2: AnnotationFeatureSnapshot,
) {
  assert.deepEqual(
    { ...feature1, _id: undefined },
    { ...feature2, _id: undefined },
  )
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
})
