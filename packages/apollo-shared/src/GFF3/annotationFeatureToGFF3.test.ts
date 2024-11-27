/* eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it } from 'node:test'
import { assert } from 'chai'
import { readAnnotationFeatureSnapshot } from './gff3ToAnnotationFeature.test'
import { annotationFeatureToGFF3 } from './annotationFeatureToGFF3'

describe('annotationFeatureToGFF3', () => {
  it('Convert one gene test fields', () => {
    const annotationFeature = readAnnotationFeatureSnapshot(
      'test_data/gene.json',
    )
    const [gff3Feature] = annotationFeatureToGFF3(annotationFeature)

    assert.deepEqual(gff3Feature.seq_id, 'chr1')
    assert.deepEqual(gff3Feature.type, 'gene')
    assert.deepEqual(gff3Feature.start, 1000)
    assert.deepEqual(gff3Feature.end, 9000)
    assert.deepEqual(gff3Feature.strand, '+')
    assert.deepEqual(gff3Feature.score, 123)
    assert.deepEqual(gff3Feature.source, 'test_data')
  })
  it.skip('Convert one gene test phase', () => {
    const annotationFeature = readAnnotationFeatureSnapshot(
      'test_data/gene.json',
    )
    const [gff3Feature] = annotationFeatureToGFF3(annotationFeature)
    const cds = gff3Feature.child_features[0][0].child_features[2][0]
    assert.deepEqual(cds.start, 1201)
    assert.deepEqual(cds.phase, '0')
  })
  it('Convert one gene test attributes', () => {
    const annotationFeature = readAnnotationFeatureSnapshot(
      'test_data/gene.json',
    )
    const [gff3Feature] = annotationFeatureToGFF3(annotationFeature)

    assert.deepEqual(gff3Feature.attributes?.Name, ['EDEN'])
    assert.deepEqual(gff3Feature.attributes?.testid, ['t001', 't003'])
    assert.deepEqual(gff3Feature.attributes?.ID, ['gene10001'])
    assert.deepEqual(gff3Feature.attributes?.Ontology_term, [
      'GO1234',
      'GO4567',
      'SO1234',
    ])
    assert.deepEqual(gff3Feature.attributes?.Alias, ['myalias'])
    assert.deepEqual(gff3Feature.attributes?.Target, ['mytarget'])
    assert.deepEqual(gff3Feature.attributes?.Gap, ['mygap'])
    assert.deepEqual(gff3Feature.attributes?.Derives_from, ['myderives'])
    assert.deepEqual(gff3Feature.attributes?.Note, ['mynote'])
    assert.deepEqual(gff3Feature.attributes?.Dbxref, ['mydbxref'])
    assert.deepEqual(gff3Feature.attributes?.Is_circular, ['true'])
  })
  it('Convert one gene test children', () => {
    const annotationFeature = readAnnotationFeatureSnapshot(
      'test_data/gene.json',
    )
    const [gff3Feature] = annotationFeatureToGFF3(annotationFeature)
    const [children] = gff3Feature.child_features
    const [mrna] = children
    assert.deepEqual(mrna.type, 'mRNA')
    assert.deepEqual(mrna.attributes?.Parent, ['gene10001'])

    const [cds] = mrna.child_features[2]
    assert.deepEqual(cds.type, 'CDS')
    assert.deepEqual(cds.attributes?.ID, ['cds10001'])
    assert.deepEqual(cds.attributes?.Parent, ['mRNA10001'])
  })
})
