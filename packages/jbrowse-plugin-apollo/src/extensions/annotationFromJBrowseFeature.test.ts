import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { describe, expect, it } from '@jest/globals'
import { jbrowseFeatureToAnnotationFeature } from './annotationFromJBrowseFeature'

describe('Convert JBrowse feature to annotation feature', () => {
  it('Convert gff', () => {
    const feature = new SimpleFeature({
      uniqueId: 'a',
      id: 'gene01',
      start: 3,
      end: 27,
      strand: 1,
      type: 'gene',
      source: 'mySource',
      refName: 'chr1',
      derived_features: [],
      subfeatures: [
        {
          uniqueId: 'b',
          id: 'mrna01',
          parent: 'gene01',
          start: 3,
          end: 27,
          strand: 1,
          type: 'mRNA',
          source: 'mySource',
          refName: 'chr1',
          derived_features: [],
          subfeatures: [
            {
              uniqueId: 'c',
              id: 'exon01',
              parent: 'mrna01',
              start: 3,
              end: 27,
              strand: 1,
              type: 'exon',
              source: 'mySource',
              refName: 'chr1',
              derived_features: [],
              subfeatures: [],
            },
            {
              uniqueId: 'd',
              id: 'cds01',
              parent: 'mrna01',
              name: 'XYZ',
              description: 'Stuff',
              xkey: 'xvalue',
              start: 15,
              end: 27,
              strand: 1,
              type: 'CDS',
              source: 'mySource',
              refName: 'chr1',
              derived_features: [],
              phase: 0,
              subfeatures: [],
            },
          ],
        },
      ],
    })
    const af = jbrowseFeatureToAnnotationFeature(feature, 'abcd')
    expect(af.refSeq).toStrictEqual('abcd')
    expect(af.strand).toEqual(1)
    expect(af.min).toEqual(3)
    const mrna = af.children ? Object.values(af.children) : undefined
    if (mrna) {
      expect(mrna.length).toEqual(1)
    } else {
      throw new Error('Children expected')
    }
    const cds = mrna.at(0)?.children
    if (cds) {
      expect(Object.values(cds).length).toEqual(2)
      const xcds = Object.values(cds).at(1)
      expect(xcds?.type).toStrictEqual('CDS')
      expect(xcds?.min).toStrictEqual(15)
      expect(xcds?.max).toStrictEqual(27)
      expect(xcds?.attributes?.name?.at(0)).toStrictEqual('XYZ')
    } else {
      throw new Error('Children expected')
    }
  })
})
