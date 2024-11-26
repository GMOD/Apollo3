/* eslint-disable @typescript-eslint/no-floating-promises */

import { describe, it } from 'node:test'
import { assert } from 'chai'
import { readAnnotationFeatureSnapshot } from './gff3ToAnnotationFeature.test'
import { annotationFeatureToGFF3 } from './annotationFeatureToGFF3'

describe('annotationFeatureToGFF3', () => {
  it('Convert one gene', () => {
    const annotationFeature = readAnnotationFeatureSnapshot(
      'test_data/gene.json',
    )
    const [gff3Feature] = annotationFeatureToGFF3(annotationFeature)

    assert.deepEqual(gff3Feature.type, 'gene')
    assert.deepEqual(gff3Feature.start, 1000)
    assert.deepEqual(gff3Feature.end, 9000)
    assert.deepEqual(gff3Feature.strand, '+')
    assert.deepEqual(gff3Feature.score, 123)
    assert.deepEqual(gff3Feature.source, 'test_data')
    assert.deepEqual(gff3Feature.attributes?.Name, ['EDEN'])
    assert.deepEqual(gff3Feature.attributes?.testid, ['t003'])
    assert.deepEqual(gff3Feature.attributes?.ID, ['gene10001'])

    const [children] = gff3Feature.child_features
    const [mrna] = children
    assert.deepEqual(mrna.type, 'mRNA')
    assert.deepEqual(mrna.attributes?.Parent, ['gene10001'])

    // Sanity check the annotationFeature does have a score, etc.
    // assert.deepEqual(annotationFeature.attributes?.gff_score, ['123'])
    // assert.deepEqual(annotationFeature.attributes?.gff_source, ['test_data'])
  })
})
