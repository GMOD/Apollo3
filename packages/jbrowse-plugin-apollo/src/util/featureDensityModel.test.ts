import type { FeatureDensity } from '@apollo-annotation/shared'
import { destroy, types } from '@jbrowse/mobx-state-tree'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { observable, runInAction } from 'mobx'

const lgv = observable({
  initialized: true,
  bpPerPx: 10,
  dynamicBlocks: {
    contentBlocks: [
      { assemblyName: 'asm', refName: 'ctgA', start: 1000, end: 2000 },
    ],
  },
})

let resolvers: ((density: FeatureDensity) => void)[] = []
const getFeatureDensity = jest.fn(
  () =>
    new Promise<FeatureDensity>((resolve) => {
      resolvers.push(resolve)
    }),
)

const actualUtil = await import('@jbrowse/core/util')
jest.unstable_mockModule('@jbrowse/core/util', () => ({
  ...actualUtil,
  getContainingView: () => lgv,
  getSession: () => ({ apolloDataStore: { getFeatureDensity } }),
}))
const actualConfiguration = await import('@jbrowse/core/configuration')
jest.unstable_mockModule('@jbrowse/core/configuration', () => ({
  ...actualConfiguration,
  getConf: jest.fn(),
}))

const { FeatureDensityMixin } = await import('./featureDensityModel')

function density(count: number): FeatureDensity {
  return { count, start: 0, binSize: 10, bins: [] }
}

async function respond(count: number) {
  const resolve = resolvers.shift()
  if (!resolve) {
    throw new Error('No pending request')
  }
  resolve(density(count))
  // Let the promise callbacks run
  await Promise.resolve()
  await Promise.resolve()
}

function setView(bpPerPx: number, start: number, end: number) {
  runInAction(() => {
    lgv.bpPerPx = bpPerPx
    lgv.dynamicBlocks.contentBlocks[0].start = start
    lgv.dynamicBlocks.contentBlocks[0].end = end
  })
}

const roots: { display: unknown }[] = []

function makeDisplay(snapshot = {}) {
  const root = types
    .model({ display: FeatureDensityMixin() })
    .create({ display: snapshot })
  roots.push(root)
  return root.display
}

describe('FeatureDensityMixin', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      destroy(root)
    }
  })

  beforeEach(() => {
    resolvers = []
    getFeatureDensity.mockClear()
    setView(10, 1000, 2000)
  })

  it('shows features when the count is under the limit', async () => {
    const display = makeDisplay({ maxFeatureCount: 100 })
    expect(display.displayMode).toBe('pending')
    expect(display.densityStatsNeeded).toBe(true)
    display.fetchDensityStats()
    expect(getFeatureDensity).toHaveBeenCalledTimes(1)
    await respond(50)
    expect(display.displayMode).toBe('features')
    expect(display.canLoadFeatures).toBe(true)
    // Panning inside the checked region doesn't need a new check
    setView(10, 1200, 1800)
    expect(display.densityStatsNeeded).toBe(false)
    expect(display.canLoadFeatures).toBe(true)
  })

  it('shows density when the count is over the limit', async () => {
    const display = makeDisplay({ maxFeatureCount: 100 })
    display.fetchDensityStats()
    await respond(500)
    expect(display.displayMode).toBe('density')
    expect(display.canLoadFeatures).toBe(false)
    display.forceLoadFeatures()
    expect(display.displayMode).toBe('features')
    expect(display.canLoadFeatures).toBe(true)
    // Zooming out further than where features were forced to load
    setView(20, 0, 2000)
    expect(display.displayMode).toBe('density')
  })

  it("doesn't load features using stale stats after zooming out", async () => {
    const display = makeDisplay({ maxFeatureCount: 100 })
    display.fetchDensityStats()
    await respond(50)
    setView(1000, 0, 100_000)
    // Keeps showing features until the new stats arrive...
    expect(display.displayMode).toBe('features')
    // ...but doesn't load any more
    expect(display.canLoadFeatures).toBe(false)
    display.fetchDensityStats()
    await respond(5000)
    expect(display.displayMode).toBe('density')
  })

  it('ignores responses for views that are no longer current', async () => {
    const display = makeDisplay({ maxFeatureCount: 100 })
    display.fetchDensityStats()
    setView(1000, 0, 100_000)
    display.fetchDensityStats()
    // The first request responds after the second was made
    await respond(50)
    expect(display.densityStats).toBeUndefined()
    await respond(5000)
    expect(display.displayMode).toBe('density')
  })

  it('uses the zoom threshold in fixed mode', () => {
    const display = makeDisplay({ thresholdMode: 'fixed', zoomThreshold: 50 })
    expect(display.displayMode).toBe('features')
    expect(display.densityStatsNeeded).toBe(false)
    expect(display.canLoadFeatures).toBe(true)
    setView(50, 0, 100_000)
    expect(display.displayMode).toBe('density')
    expect(display.densityStatsNeeded).toBe(true)
  })

  it('reports errors loading density', async () => {
    getFeatureDensity.mockImplementationOnce(() =>
      Promise.reject(new Error('Server error')),
    )
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(jest.fn())
    const display = makeDisplay()
    display.fetchDensityStats()
    await Promise.resolve()
    await Promise.resolve()
    expect(display.densityError).toBe('Server error')
    expect(display.densityMessage).toMatch(/Could not load feature density/)
    consoleError.mockRestore()
  })

  it('updates settings from the dialog', () => {
    const display = makeDisplay()
    expect(display.thresholdModeSetting).toBe('auto')
    expect(display.maxFeatureCountSetting).toBe(200)
    expect(display.zoomThresholdSetting).toBe(200)
    display.setFeatureDisplayThreshold({
      mode: 'fixed',
      maxFeatureCount: 10,
      zoomThreshold: 5,
    })
    expect(display.thresholdModeSetting).toBe('fixed')
    expect(display.maxFeatureCountSetting).toBe(10)
    expect(display.zoomThresholdSetting).toBe(5)
  })
})
