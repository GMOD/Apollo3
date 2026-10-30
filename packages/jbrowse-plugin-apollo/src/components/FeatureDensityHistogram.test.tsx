import { describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { FeatureDensityHistogramModel } from './FeatureDensityHistogram'

// Server rendering with tss-react needs an Emotion cache, so stub the styles
const classes = new Proxy({}, { get: (_target, name) => String(name) })
function getClasses() {
  return { classes }
}
function makeStylesHook() {
  return getClasses
}
function makeStyles() {
  return makeStylesHook
}
jest.unstable_mockModule('tss-react/mui', () => ({ makeStyles }))

const {
  FeatureDensityHistogram,
  getBarSegments,
  getDensityBars,
  getScaleTicks,
  getTickPositions,
} = await import('./FeatureDensityHistogram')

type Lgv = Parameters<typeof getDensityBars>[0]

function makeLgv(
  contentBlocks: {
    refName: string
    start: number
    end: number
    offsetPx: number
    reversed?: boolean
  }[],
) {
  return {
    bpPerPx: 10,
    offsetPx: 0,
    width: 1000,
    dynamicBlocks: {
      totalWidthPx: 1000,
      contentBlocks: contentBlocks.map((block) => ({
        ...block,
        assemblyName: 'asm',
        key: `${block.refName}-${block.offsetPx}`,
        widthPx: (block.end - block.start) / 10,
      })),
    },
  } as unknown as Lgv
}

describe('getDensityBars', () => {
  const density = { count: 3, start: 0, binSize: 100, bins: [1, 2, 3] }

  it('positions bins within their block', () => {
    const lgv = makeLgv([
      { refName: 'ctgA', start: 50, end: 300, offsetPx: 0 },
      { refName: 'ctgB', start: 0, end: 300, offsetPx: 40 },
    ])
    const bars = getDensityBars(
      lgv,
      [density],
      [{ assemblyName: 'asm', refName: 'ctgA' }],
    )
    // The first bin is clipped to the block, which starts at 50
    expect(bars.map(({ count, width, x }) => ({ count, width, x }))).toEqual([
      { count: 1, width: 5, x: 0 },
      { count: 2, width: 10, x: 5 },
      { count: 3, width: 10, x: 15 },
    ])
  })

  it('flips bins in reversed blocks', () => {
    const lgv = makeLgv([
      { refName: 'ctgA', start: 0, end: 300, offsetPx: 0, reversed: true },
    ])
    const bars = getDensityBars(
      lgv,
      [density],
      [{ assemblyName: 'asm', refName: 'ctgA' }],
    )
    expect(bars.map(({ count, x }) => ({ count, x }))).toEqual([
      { count: 1, x: 20 },
      { count: 2, x: 10 },
      { count: 3, x: 0 },
    ])
  })

  it('carries strand counts for each bin', () => {
    const lgv = makeLgv([{ refName: 'ctgA', start: 0, end: 300, offsetPx: 0 }])
    const bars = getDensityBars(
      lgv,
      [
        {
          ...density,
          strandBins: {
            forward: [1, 0, 2],
            reverse: [0, 2, 0],
            unstranded: [0, 0, 1],
          },
        },
      ],
      [{ assemblyName: 'asm', refName: 'ctgA' }],
    )
    expect(bars.map(({ strandCounts }) => strandCounts)).toEqual([
      { forward: 1, reverse: 0, unstranded: 0 },
      { forward: 0, reverse: 2, unstranded: 0 },
      { forward: 2, reverse: 0, unstranded: 1 },
    ])
  })

  it('ignores densities for other reference sequences', () => {
    const lgv = makeLgv([{ refName: 'ctgB', start: 0, end: 300, offsetPx: 0 }])
    expect(
      getDensityBars(
        lgv,
        [density],
        [{ assemblyName: 'asm', refName: 'ctgA' }],
      ),
    ).toEqual([])
  })
})

describe('getScaleTicks', () => {
  it('rounds the top of the scale up to a nice step', () => {
    expect(getScaleTicks(23)).toEqual({ scaleMax: 30, ticks: [0, 10, 20, 30] })
    expect(getScaleTicks(1000)).toEqual({
      scaleMax: 1000,
      ticks: [0, 500, 1000],
    })
  })

  it('uses fewer ticks when asked', () => {
    expect(getScaleTicks(23, 2)).toEqual({ scaleMax: 40, ticks: [0, 20, 40] })
  })

  it('uses whole-number steps for small counts', () => {
    expect(getScaleTicks(1)).toEqual({ scaleMax: 1, ticks: [0, 1] })
    expect(getScaleTicks(3)).toEqual({ scaleMax: 3, ticks: [0, 1, 2, 3] })
  })
})

describe('getBarSegments', () => {
  const bar = {
    key: 'bar',
    x: 0,
    width: 10,
    count: 6,
    assemblyName: 'asm',
    refName: 'ctgA',
    start: 0,
    end: 100,
    strandCounts: { forward: 3, reverse: 1, unstranded: 2 },
  }

  it('grows a single segment up from the bottom without strands', () => {
    expect(getBarSegments(bar, 10, false, 'blue')).toEqual([
      { key: 'all', color: 'blue', y: 0, height: 0.6 },
    ])
  })

  it('mirrors + above and − below the middle, splitting unstranded', () => {
    const segments = getBarSegments(bar, 4, true, 'blue')
    expect(segments.map(({ height, key, y }) => ({ key, y, height }))).toEqual([
      { key: 'forward', y: 0.5, height: 0.375 },
      { key: 'unstranded-up', y: 0.875, height: 0.125 },
      { key: 'reverse', y: 0.375, height: 0.125 },
      { key: 'unstranded-down', y: 0.25, height: 0.125 },
    ])
  })
})

describe('getTickPositions', () => {
  it('repeats ticks above and below the middle when mirrored', () => {
    expect(
      getTickPositions([0, 10, 20], 20, true).map(({ position, value }) => [
        value,
        position,
      ]),
    ).toEqual([
      [0, 0.5],
      [10, 0.75],
      [10, 0.25],
      [20, 1],
      [20, 0],
    ])
  })
})

function makeModel(
  overrides: Partial<FeatureDensityHistogramModel>,
): FeatureDensityHistogramModel {
  return {
    densityLgv: makeLgv([
      { refName: 'ctgA', start: 0, end: 300, offsetPx: 0 },
    ]) as FeatureDensityHistogramModel['densityLgv'],
    densityStats: {
      key: 'key',
      regions: [{ assemblyName: 'asm', refName: 'ctgA', start: 0, end: 300 }],
      densities: [
        {
          count: 1234,
          start: 0,
          binSize: 100,
          bins: [1, 2, 3],
          strandBins: {
            forward: [1, 0, 1],
            reverse: [0, 2, 1],
            unstranded: [0, 0, 1],
          },
        },
      ],
    },
    displayMode: 'density',
    featureCountInView: 1234,
    maxFeatureCountSetting: 1000,
    thresholdModeSetting: 'auto',
    zoomThresholdSetting: 200,
    forceLoadFeatures: jest.fn(),
    ...overrides,
  }
}

describe('FeatureDensityHistogram', () => {
  it('shows the feature count and a bar per bin', () => {
    const markup = renderToStaticMarkup(
      <FeatureDensityHistogram model={makeModel({})} />,
    )
    expect(markup).toContain('1,234 features in view')
    expect(markup).toContain('show them anyway')
    expect(markup.match(/data-testid="feature-density-bar"/g)).toHaveLength(3)
    expect(markup).toContain('data-testid="feature-density-scale"')
    // A hover target per bar plus segments for the non-zero strand counts
    // (and each half of the unstranded count)
    expect(markup.match(/<rect/g)).toHaveLength(9)
    expect(markup).toContain('no strand')
  })

  it('draws single-color bars without strand information', () => {
    const model = makeModel({})
    const [density] = model.densityStats?.densities ?? []
    delete density.strandBins
    const markup = renderToStaticMarkup(
      <FeatureDensityHistogram model={model} />,
    )
    expect(markup.match(/<rect/g)).toHaveLength(6)
    expect(markup).not.toContain('no strand')
  })

  it('explains fixed mode', () => {
    const markup = renderToStaticMarkup(
      <FeatureDensityHistogram
        model={makeModel({ thresholdModeSetting: 'fixed' })}
      />,
    )
    expect(markup).toContain('zoomed out past 200 bp/px')
  })

  it('shows progress while counting features', () => {
    const markup = renderToStaticMarkup(
      <FeatureDensityHistogram
        model={makeModel({ displayMode: 'pending', densityStats: undefined })}
      />,
    )
    expect(markup).toContain('Counting features in view')
    expect(markup).not.toContain('feature-density-bar')
  })
})
