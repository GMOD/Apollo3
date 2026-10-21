import {
  type AnnotationFeature,
  AnnotationFeatureModel,
} from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { describe, expect, it } from '@jest/globals'

import { changeHandlers } from '../session/changeHandlers'

import { getPropagatedLocationChanges } from './mouseEventsUtils'

function createGene(strand: 1 | -1 = 1) {
  const feature = (_id: string, type: string, min: number, max: number) => ({
    _id,
    type,
    min,
    max,
    refSeq: 'chr2',
    strand,
  })
  return AnnotationFeatureModel.create({
    ...feature('gene02', 'gene', 2, 40),
    children: {
      mrna02: {
        ...feature('mrna02', 'mRNA', 2, 28),
        children: {
          exon1: feature('exon1', 'exon', 2, 10),
          exon6: feature('exon6', 'exon', 12, 15),
          exon2: feature('exon2', 'exon', 24, 28),
          cds1: feature('cds1', 'CDS', 3, 26),
        },
      },
      mrna03: {
        ...feature('mrna03', 'mRNA', 4, 30),
        children: { exon3: feature('exon3', 'exon', 4, 30) },
      },
      mrna05: {
        ...feature('mrna05', 'mRNA', 25, 40),
        children: { exon10: feature('exon10', 'exon', 25, 40) },
      },
    },
  })
}

function indexFeatures(
  feature: AnnotationFeature,
): Map<string, AnnotationFeature> {
  return new Map([
    [feature._id, feature],
    ...[...(feature.children?.values() ?? [])].flatMap((child) => [
      ...indexFeatures(child),
    ]),
  ])
}

function getFeature(features: Map<string, AnnotationFeature>, id: string) {
  const feature = features.get(id)
  if (!feature) {
    throw new Error(`Fixture feature ${id} not found`)
  }
  return feature
}

describe('CDS boundary propagation', () => {
  it.each([1, -1] as const)(
    'extends the containing exon and restores the full tree on strand %s',
    async (strand) => {
      const gene = createGene(strand)
      const original = getSnapshot(gene)
      const features = indexFeatures(gene)
      const cds = getFeature(features, 'cds1')
      const changes = getPropagatedLocationChanges(cds, 33, 'max', true)
      expect(changes).toEqual(
        expect.arrayContaining([
          { featureId: 'cds1', oldLocation: 26, newLocation: 33 },
          { featureId: 'exon2', oldLocation: 28, newLocation: 33 },
          { featureId: 'mrna02', oldLocation: 28, newLocation: 33 },
        ]),
      )
      expect(changes.map((change) => change.featureId)).toHaveLength(3)
      const change = new LocationEndChange({
        typeName: 'LocationEndChange',
        assembly: 'assembly',
        changedIds: changes.map((c) => c.featureId),
        changes: changes.map((c) => ({
          featureId: c.featureId,
          oldEnd: c.oldLocation,
          newEnd: c.newLocation,
        })),
      })
      const store = {
        getFeature: (id: string) => features.get(id),
      } as Parameters<typeof changeHandlers.LocationEndChange>[0]
      await changeHandlers.LocationEndChange(store, change)
      expect(getFeature(features, 'exon2').max).toBe(33)
      expect(getFeature(features, 'mrna02').max).toBe(33)
      expect(gene.max).toBe(40)
      expect(getSnapshot(getFeature(features, 'mrna03'))).toEqual(
        original.children?.mrna03,
      )
      expect(getSnapshot(getFeature(features, 'mrna05'))).toEqual(
        original.children?.mrna05,
      )
      expect(getFeature(features, 'exon6').max).toBe(15)
      await changeHandlers.LocationEndChange(store, change.getInverse())
      expect(getSnapshot(gene)).toEqual(original)
    },
  )

  it.each([1, -1] as const)(
    'extends the first exon, transcript and gene at the minimum edge on strand %s',
    async (strand) => {
      const gene = createGene(strand)
      const original = getSnapshot(gene)
      const features = indexFeatures(gene)
      const changes = getPropagatedLocationChanges(
        getFeature(features, 'cds1'),
        0,
        'min',
        true,
      )
      expect(changes.map((c) => c.featureId).sort()).toEqual([
        'cds1',
        'exon1',
        'gene02',
        'mrna02',
      ])
      const change = new LocationStartChange({
        typeName: 'LocationStartChange',
        assembly: 'assembly',
        changedIds: changes.map((c) => c.featureId),
        changes: changes.map((c) => ({
          featureId: c.featureId,
          oldStart: c.oldLocation,
          newStart: c.newLocation,
        })),
      })
      const store = {
        getFeature: (id: string) => features.get(id),
      } as Parameters<typeof changeHandlers.LocationStartChange>[0]
      await changeHandlers.LocationStartChange(store, change)
      expect(getFeature(features, 'exon1').min).toBe(0)
      expect(gene.min).toBe(0)
      expect(getFeature(features, 'exon2').min).toBe(24)
      await changeHandlers.LocationStartChange(store, change.getInverse())
      expect(getSnapshot(gene)).toEqual(original)
    },
  )

  it('expands the gene only when the CDS passes its boundary, without duplicate changes', () => {
    const features = indexFeatures(createGene())
    const changes = getPropagatedLocationChanges(
      getFeature(features, 'cds1'),
      45,
      'max',
      true,
    )
    expect(changes.map((c) => c.featureId).sort()).toEqual([
      'cds1',
      'exon2',
      'gene02',
      'mrna02',
    ])
  })

  it('retains untranslated exon sequence when the new CDS end remains inside its exon', () => {
    const features = indexFeatures(createGene())
    expect(
      getPropagatedLocationChanges(
        getFeature(features, 'cds1'),
        27,
        'max',
        true,
      ),
    ).toEqual([{ featureId: 'cds1', oldLocation: 26, newLocation: 27 }])
  })

  it('retains existing propagation when no exon contains the old CDS edge', () => {
    const gene = createGene()
    getFeature(indexFeatures(gene), 'mrna02').deleteChild('exon2')
    const features = indexFeatures(gene)
    expect(
      getPropagatedLocationChanges(
        getFeature(features, 'cds1'),
        33,
        'max',
        true,
      ).map((c) => c.featureId),
    ).toEqual(['cds1', 'mrna02'])
  })

  it('does not shrink an exon when shortening a CDS', () => {
    const features = indexFeatures(createGene())
    expect(
      getPropagatedLocationChanges(
        getFeature(features, 'cds1'),
        25,
        'max',
        true,
      ),
    ).toEqual([{ featureId: 'cds1', oldLocation: 26, newLocation: 25 }])
  })

  it('does not extend an adjacent exon at the old exclusive CDS end', () => {
    const gene = createGene()
    const transcript = getFeature(indexFeatures(gene), 'mrna02')
    getFeature(indexFeatures(transcript), 'exon2').setMax(26)
    transcript.addChild({
      _id: 'adjacent',
      type: 'exon',
      min: 26,
      max: 28,
      refSeq: 'chr2',
    })
    const features = indexFeatures(gene)
    const changes = getPropagatedLocationChanges(
      getFeature(features, 'cds1'),
      33,
      'max',
      true,
    )
    expect(changes.filter((c) => c.featureId === 'exon2')).toEqual([
      { featureId: 'exon2', oldLocation: 26, newLocation: 33 },
    ])
    expect(changes.some((c) => c.featureId === 'adjacent')).toBe(false)
  })

  it('keeps a later exon and a transcript that already contains the extension unchanged', () => {
    const gene = createGene()
    const transcript = getFeature(indexFeatures(gene), 'mrna02')
    transcript.setMax(40)
    transcript.addChild({
      _id: 'later',
      type: 'exon',
      min: 35,
      max: 40,
      refSeq: 'chr2',
    })
    const features = indexFeatures(gene)
    const changes = getPropagatedLocationChanges(
      getFeature(features, 'cds1'),
      33,
      'max',
      true,
    )
    expect(changes.map((c) => c.featureId)).toEqual(['cds1', 'exon2'])
    expect(getFeature(features, 'later').min).toBe(35)
    expect(transcript.max).toBe(40)
  })

  it('recognizes ontology-equivalent CDS and exon types', () => {
    const features = indexFeatures(createGene())
    const cds = getFeature(features, 'cds1')
    cds.setType('coding_exon')
    getFeature(features, 'exon2').setType('noncoding_exon')
    const ontology = {
      isTypeOf: (type: string, parent: string) =>
        type === parent ||
        (type === 'coding_exon' && parent === 'CDS') ||
        (type === 'noncoding_exon' && parent === 'exon'),
    }
    expect(
      getPropagatedLocationChanges(cds, 33, 'max', true, ontology).map(
        (c) => c.featureId,
      ),
    ).toEqual(['cds1', 'exon2', 'mrna02'])
  })

  it('preserves generic feature expansion without extending unrelated exon siblings', () => {
    const features = indexFeatures(createGene())
    const feature = getFeature(features, 'cds1')
    feature.setType('protein_match')
    expect(
      getPropagatedLocationChanges(feature, 33, 'max', true).map(
        (c) => c.featureId,
      ),
    ).toEqual(['cds1', 'mrna02'])
  })
})
