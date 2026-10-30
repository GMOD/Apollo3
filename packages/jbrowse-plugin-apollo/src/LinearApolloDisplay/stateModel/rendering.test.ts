import { destroy, types } from '@jbrowse/mobx-state-tree'
import { expect, it, jest } from '@jest/globals'

const draw = jest.fn()
const drawOverlay = jest.fn()
const blocks = ['empty', 'annotated'].map((refName, i) => ({
  refName,
  start: 0,
  end: 100,
  offsetPx: i * 100,
  widthPx: 100,
}))
const layouts = new Map([
  [
    'assembly',
    new Map([
      [
        'annotated',
        {
          byRow: [[{ feature: { min: 10, max: 20 }, rowInFeature: 0 }]],
        },
      ],
    ]),
  ],
])

jest.unstable_mockModule('./layouts', () => ({
  layoutsModelFactory: () =>
    types
      .model({})
      .volatile(() => ({
        height: 100,
        lgv: {
          initialized: true,
          assemblyNames: ['assembly'],
          offsetPx: 0,
          dynamicBlocks: { totalWidthPx: 200, contentBlocks: blocks },
        },
        session: { collaborators: [] },
        layouts,
      }))
      .views(() => ({
        get displayMode() {
          return 'features' as const
        },
        highestRow: () => 0,
        get featureGlyphs() {
          return new Map()
        },
        getGlyph: () => ({ draw, drawOverlay }),
      })),
}))

const { renderingModelFactory } = await import('./rendering')

it.each([
  ['empty', 'annotated'],
  ['annotated', 'empty'],
  ['annotated', 'annotated'],
  ['empty', 'empty'],
])(
  'renders all annotated blocks and restores clipping for %s then %s',
  (first, second) => {
    jest.clearAllMocks()
    blocks[0].refName = first
    blocks[1].refName = second
    const expectedDraws =
      Number(first === 'annotated') + Number(second === 'annotated')
    let depth = 0
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
    }
    const Display = renderingModelFactory({} as never, {} as never)
    const Root = types.model({ display: Display })
    const root = Root.create({ display: { type: 'LinearApolloDisplay' } })
    try {
      const createCanvas = () =>
        ({
          width: 200,
          height: 100,
          getContext: () => ctx,
        }) as unknown as HTMLCanvasElement
      root.display.setCanvas(createCanvas())
      expect({
        draws: draw.mock.calls.length,
        overlays: drawOverlay.mock.calls.length,
        depth,
      }).toEqual({ draws: expectedDraws, overlays: expectedDraws, depth: 0 })
      root.display.setCanvas(createCanvas())
      expect({
        draws: draw.mock.calls.length,
        overlays: drawOverlay.mock.calls.length,
        depth,
      }).toEqual({
        draws: expectedDraws * 2,
        overlays: expectedDraws * 2,
        depth: 0,
      })
      expect(ctx.clearRect).toHaveBeenCalledTimes(2)
    } finally {
      destroy(root)
    }
  },
)
