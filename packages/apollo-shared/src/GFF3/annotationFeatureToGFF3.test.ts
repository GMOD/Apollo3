/* eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it } from 'node:test'
import { assert } from 'chai'
import { readAnnotationFeatureSnapshot } from './gff3ToAnnotationFeature.test'
import { annotationFeatureToGFF3 } from './annotationFeatureToGFF3'
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

describe('annotationFeatureToGFF3', () => {
  it('Test mandatory columns', () => {
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
  it('Feature with no children and no gff_id has no ID attribute', () => {
    const annotationFeature = JSON.parse(`{
      "_id": "66d70e4ccc30b55b65e5f619",
      "refSeq": "chr1",
      "type": "gene",
      "min": 999,
      "max": 9000,
      "strand": 1,
      "attributes": {}
    }`) as AnnotationFeatureSnapshot
    const [gff3Feature] = annotationFeatureToGFF3(annotationFeature)
    assert.isUndefined(gff3Feature.attributes?.ID)
  })
  it('Feature with children and no gff_id has internal _id as ID', () => {
    const annotationFeature = JSON.parse(`{
      "_id": "66d70e4ccc30b55b65e5f619",
      "refSeq": "chr1",
      "type": "gene",
      "min": 999,
      "max": 9000,
      "strand": 1,
      "attributes": {},
      "children": {
        "66d70e4ccc30b55b65e5f618": {
          "_id": "66d70e4ccc30b55b65e5f618",
          "refSeq": "chr1",
          "type": "gene_segment",
          "min": 1049,
          "max": 9000,
          "strand": 1,
          "attributes": {}
        }
      }
    }`) as AnnotationFeatureSnapshot
    const [gff3Feature] = annotationFeatureToGFF3(annotationFeature)
    assert.deepEqual(gff3Feature.attributes?.ID, ['66d70e4ccc30b55b65e5f619'])
  })
  it('Convert multiple scores', () => {
    const annotationFeature = JSON.parse(`{
      "_id": "66d70e4ccc30b55b65e5f619",
      "refSeq": "chr1",
      "type": "gene",
      "min": 999,
      "max": 9000,
      "strand": 1,
      "attributes": {
        "gff_id": ["gene10001"],
        "gff_score": ["123", "345"]
      }
    }`) as AnnotationFeatureSnapshot
    const [gff3Feature] = annotationFeatureToGFF3(annotationFeature)
    assert.deepEqual(gff3Feature.score, 123)
  })
  it('Convert invalid score', () => {
    const annotationFeature = JSON.parse(`{
      "_id": "66d70e4ccc30b55b65e5f619",
      "refSeq": "chr1",
      "type": "gene",
      "min": 999,
      "max": 9000,
      "strand": 1,
      "attributes": {
        "gff_id": ["gene10001"],
        "gff_score": ["xyz"]
      }
    }`) as AnnotationFeatureSnapshot
    const [gff3Feature] = annotationFeatureToGFF3(annotationFeature)
    assert.deepEqual(gff3Feature.score, null)
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
  it('Convert CDSs', () => {
    const annotationFeature = readAnnotationFeatureSnapshot(
      'test_data/gene.json',
    )
    const [gff3Feature] = annotationFeatureToGFF3(annotationFeature)
    const [children] = gff3Feature.child_features
    const [mrna] = children
    const cds10001 = mrna.child_features.filter((child) => {
      const id = child[0].attributes?.ID
      return id !== undefined && id[0] === 'cds10001'
    })
    assert.deepEqual(cds10001.length, 2)

    const cds1_1 = cds10001[0][0]
    assert.deepEqual(cds1_1.attributes?.ID, ['cds10001'])
    assert.deepEqual(cds1_1.start, 1201)
    assert.deepEqual(cds1_1.end, 1500)
    assert.deepEqual(cds1_1.phase, '0')

    const cds1_2 = cds10001[1][0]
    assert.deepEqual(cds1_2.attributes?.ID, ['cds10001'])
    assert.deepEqual(cds1_2.start, 5000)
    assert.deepEqual(cds1_2.end, 5100)
    assert.deepEqual(cds1_2.phase, '0')

    assert.deepEqual(cds1_1.child_features[0][0].attributes?.ID, [
      'cds_region10001',
    ])
    assert.deepEqual(cds1_1.child_features[0][0].start, 1351)
    assert.deepEqual(cds1_1.child_features[0][0].end, 1400)
    assert.deepEqual(cds1_1.child_features[0][0].phase, null)

    const cds10004 = mrna.child_features.filter((child) => {
      const id = child[0].attributes?.ID
      return id !== undefined && id[0] === 'cds10004'
    })
    assert.deepEqual(cds10004.length, 2)
    const cds4_1 = cds10004[0][0]
    assert.deepEqual(cds4_1.attributes?.ID, ['cds10004'])
  })
})
