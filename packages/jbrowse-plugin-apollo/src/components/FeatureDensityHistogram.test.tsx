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

const { FeatureDensityHistogram, getDensityBars } = await import(
  './FeatureDensityHistogram'
)

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
      densities: [{ count: 1234, start: 0, binSize: 100, bins: [1, 2, 3] }],
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
