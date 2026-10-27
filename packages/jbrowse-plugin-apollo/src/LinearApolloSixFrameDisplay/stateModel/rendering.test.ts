import { destroy, types } from '@jbrowse/mobx-state-tree'
import { expect, it, jest } from '@jest/globals'

const draw = jest.fn()
const blocks = ['empty', 'annotated'].map((refName, i) => ({
  assemblyName: 'assembly',
  refName,
  regionNumber: i,
  start: 0,
  end: 100,
  offsetPx: i * 100,
  widthPx: 100,
}))
const gene = { min: 10, max: 20 }
Object.assign(gene, { topLevelFeature: gene })
const layoutFor = (refName: string) =>
  refName === 'annotated'
    ? new Map([[4, [{ rowNum: 4, feature: gene }]]])
    : new Map()
const getSequence = jest.fn((start: number, end: number) =>
  'A'.repeat(end - start),
)
const codonState = { showStartCodons: false }

jest.unstable_mockModule('../../util/glyphUtils', () => ({
  looksLikeGene: () => true,
}))
jest.unstable_mockModule('../../util/displayUtils', () => ({
  codonColorCode: () => 'red',
}))
jest.unstable_mockModule('./layouts', () => ({
  layoutsModelFactory: () =>
    types
      .model({})
      .volatile(() => ({
        height: 100,
        showFeatureLabels: false,
        showStopCodons: false,
        lgv: {
          initialized: true,
          bpPerPx: 1,
          offsetPx: 0,
          dynamicBlocks: { totalWidthPx: 200, contentBlocks: blocks },
        },
        session: {
          collaborators: [],
          apolloDataStore: {
            assemblies: new Map([
              [
                'assembly',
                {
                  getByRefName: (refName: string) =>
                    refName === 'annotated' ? { getSequence } : undefined,
                },
              ],
            ]),
          },
        },
      }))
      .views(() => ({
        get featureLayouts() {
          return blocks.map((block) => layoutFor(block.refName))
        },
        get showStartCodons() {
          return codonState.showStartCodons
        },
        get highestRow() {
          return 5
        },
        regionCannotBeRendered: () => false,
        getGlyph: () => ({ draw }),
      })),
}))

const { renderingModelFactory } = await import('./rendering')

it.each([
  ['empty', 'annotated', false],
  ['annotated', 'empty', false],
  ['annotated', 'annotated', false],
  ['empty', 'empty', false],
  ['empty', 'annotated', true],
  ['annotated', 'empty', true],
])(
  'renders all annotated blocks and restores clipping for %s then %s (codons: %s)',
  (first, second, showStartCodons) => {
    jest.clearAllMocks()
    blocks[0].refName = first
    blocks[1].refName = second
    codonState.showStartCodons = showStartCodons
    const annotatedBlocks = blocks.filter((b) => b.refName === 'annotated')
    let depth = 0
    const fillRect = jest.fn()
    const ctx = {
      save: jest.fn(() => {
        depth++
      }),
      restore: jest.fn(() => {
        depth--
      }),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      rect: jest.fn(),
      clip: jest.fn(),
      fillRect,
    }
    const Display = renderingModelFactory({} as never, {} as never)
    const Root = types.model({ display: Display })
    const root = Root.create({
      display: { type: 'LinearApolloSixFrameDisplay' },
    })
    try {
      root.display.setCanvas({
        width: 200,
        height: 100,
        getContext: () => ctx,
      } as unknown as HTMLCanvasElement)
      expect(depth).toBe(0)
      expect(ctx.clip).toHaveBeenCalledTimes(blocks.length)
      expect(draw.mock.calls.map((call) => call[4])).toEqual(annotatedBlocks)
      if (showStartCodons) {
        expect(getSequence).toHaveBeenCalledTimes(annotatedBlocks.length)
        const drawnBlockOffsets = new Set(
          fillRect.mock.calls.map(
            (call) => Math.floor((call[0] as number) / 100) * 100,
          ),
        )
        expect(drawnBlockOffsets).toEqual(
          new Set(annotatedBlocks.map((b) => b.offsetPx)),
        )
      } else {
        expect(getSequence).not.toHaveBeenCalled()
      }
    } finally {
      destroy(root)
    }
  },
)
