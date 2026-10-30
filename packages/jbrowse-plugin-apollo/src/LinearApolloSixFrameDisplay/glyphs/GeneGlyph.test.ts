import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { expect, it, jest } from '@jest/globals'
import { alpha } from '@mui/material'

import { getFeaturePx, roundPxSpan } from '../../util/glyphUtils'
import type { LinearApolloSixFrameDisplayRendering } from '../stateModel/rendering'

jest.unstable_mockModule('../../components', () => ({
  MergeExons: jest.fn(),
  SplitExon: jest.fn(),
}))
jest.unstable_mockModule('../../components/FilterTranscripts', () => ({
  FilterTranscripts: jest.fn(),
}))
jest.unstable_mockModule('../../util', () => ({
  getAdjacentExons: jest.fn(),
  getContextMenuItemsForFeature: jest.fn(),
  getMinAndMaxPx: jest.fn(),
  getFeaturePx,
  roundPxSpan,
  getOverlappingEdge: jest.fn(),
  getRelatedFeatures: jest.fn(),
  getStreamIcon: jest.fn(),
  isCDSFeature: jest.fn(),
  isExonFeature: jest.fn(),
  isMousePositionWithFeature: jest.fn(),
  isSelectedFeature: (
    feature: AnnotationFeature,
    selected?: AnnotationFeature,
  ) => feature._id === selected?._id,
  navToFeatureCenter: jest.fn(),
  selectFeatureAndOpenWidget: jest.fn(),
}))

// The glyph's stripe patterns are created on import in a browser.
const originalDocument = globalThis.document
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { createElement: () => ({ getContext: () => null }) },
})
const { geneGlyph } = await import('./GeneGlyph')
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: originalDocument,
})

it.each<[string, string | undefined, boolean, 'light' | 'dark']>([
  ['pseudogene', 'rgba(148, 203, 236, 0.6)', false, 'light'],
  ['ncRNA_gene', 'rgba(194, 106, 119, 0.6)', false, 'dark'],
  ['gene', '#123456', false, 'light'],
  ['gene', undefined, false, 'light'],
  ['gene', undefined, false, 'dark'],
  ['pseudogene', 'blue', true, 'light'],
])(
  'draws %s with configured background %s (selected=%s, theme=%s)',
  (type, configuredColor, selected, mode) => {
    const gene = {
      _id: 'gene',
      type,
      attributes: new Map(),
      children: new Map(),
      min: 0,
      max: 20,
      strand: 1,
    } as unknown as AnnotationFeature
    const getValue = jest.fn(() => configuredColor)
    const paper = mode === 'light' ? '#ffffff' : '#121212'
    const display = {
      apolloRowHeight: 10,
      lgv: {
        bpPerPx: 1,
        offsetPx: 0,
      },
      theme: {
        palette: { mode, text: { primary: '#000000' }, background: { paper } },
      },
      session: {
        apolloDataStore: { ontologyManager: { featureTypeOntology: {} } },
        getPluginConfiguration: () => ({ geneBackgroundColor: { getValue } }),
      },
      selectedFeature: selected ? gene : undefined,
      showFeatureLabels: false,
    } as unknown as LinearApolloSixFrameDisplayRendering
    const fills: { color: string; rect: number[] }[] = []
    const ctx = {
      fillStyle: '',
      fillRect(this: { fillStyle: string }, ...rect: number[]) {
        fills.push({ color: this.fillStyle, rect })
      },
    } as unknown as CanvasRenderingContext2D

    for (const reversed of [false, true]) {
      const block = {
        start: 0,
        end: 100,
        offsetPx: 5,
        reversed,
      } as ContentBlock
      fills.length = 0
      geneGlyph.draw(display, ctx, gene, block)

      expect(fills[1]).toEqual({
        color: selected
          ? alpha('rgb(0,0,0)', 0.7)
          : configuredColor ?? alpha(paper, 0.7),
        rect: [reversed ? 86 : 6, 31, 18, 8],
      })
    }
    if (selected) {
      expect(getValue).not.toHaveBeenCalled()
    } else if (configuredColor !== undefined) {
      expect(getValue).toHaveBeenCalledWith({ featureType: type })
    }
  },
)
