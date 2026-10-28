/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it } from 'node:test'

import { expect } from 'chai'

import {
  alignBins,
  binRange,
  computeFeatureDensity,
  coverageFromBoundaries,
  niceBinSize,
} from './featureDensity.js'

describe('niceBinSize', () => {
  it('rounds up to 1, 2, or 5 times a power of ten', () => {
    expect(niceBinSize(0.3)).to.equal(1)
    expect(niceBinSize(1)).to.equal(1)
    expect(niceBinSize(1.5)).to.equal(2)
    expect(niceBinSize(3)).to.equal(5)
    expect(niceBinSize(7)).to.equal(10)
    expect(niceBinSize(10)).to.equal(10)
    expect(niceBinSize(600)).to.equal(1000)
    expect(niceBinSize(1200)).to.equal(2000)
  })
})

describe('alignBins', () => {
  it('expands a region to bin boundaries', () => {
    expect(alignBins(150, 1020, 100)).to.deep.equal({ start: 100, nBins: 10 })
    expect(alignBins(100, 1000, 100)).to.deep.equal({ start: 100, nBins: 9 })
    expect(alignBins(100, 100, 100)).to.deep.equal({ start: 100, nBins: 0 })
  })
})

describe('binRange', () => {
  it('uses half-open feature coordinates', () => {
    // [100, 200) is entirely in bin 1 of a window starting at 0
    expect(binRange(100, 200, 0, 100, 10)).to.deep.equal([1, 2])
    expect(binRange(99, 201, 0, 100, 10)).to.deep.equal([0, 3])
  })
  it('clips to the window', () => {
    expect(binRange(-500, 5000, 0, 100, 10)).to.deep.equal([0, 10])
  })
  it('is empty for features outside the window', () => {
    const [before0, before1] = binRange(-500, -100, 0, 100, 10)
    expect(before1).to.equal(before0)
    const [after0, after1] = binRange(1500, 1600, 0, 100, 10)
    expect(after1).to.equal(after0)
  })
  it('gives zero-length features the bin of their position', () => {
    expect(binRange(150, 150, 0, 100, 10)).to.deep.equal([1, 2])
  })
})

describe('coverageFromBoundaries', () => {
  it('prefix-sums the starts and ends', () => {
    const bins = coverageFromBoundaries(
      [
        [0, 1],
        [2, 2],
      ],
      [
        [3, 2],
        [5, 1],
      ],
      5,
    )
    expect(bins).to.deep.equal([1, 1, 3, 1, 1])
  })
})

describe('computeFeatureDensity', () => {
  it('counts every bin a long feature overlaps', () => {
    const density = computeFeatureDensity(
      [
        { min: 0, max: 1000 },
        { min: 250, max: 260 },
        { min: 2000, max: 3000 },
      ],
      0,
      1000,
      100,
    )
    expect(density).to.deep.equal({
      count: 2,
      start: 0,
      binSize: 100,
      bins: [1, 1, 2, 1, 1, 1, 1, 1, 1, 1],
    })
  })
  it('only counts features overlapping the unaligned region', () => {
    const density = computeFeatureDensity(
      [
        { min: 0, max: 10 },
        { min: 60, max: 70 },
      ],
      50,
      150,
      100,
    )
    expect(density.count).to.equal(1)
    expect(density.start).to.equal(0)
    expect(density.bins).to.deep.equal([2, 0])
  })
})
