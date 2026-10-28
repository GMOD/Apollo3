/**
 * Summary of the features in a region, used to decide whether to render
 * features and as data for a density histogram when they aren't rendered.
 */
export interface FeatureDensity {
  /** Number of top-level features overlapping the requested region */
  count: number
  /** Start of the first bin, a multiple of `binSize` */
  start: number
  binSize: number
  /**
   * Number of top-level features overlapping each bin. Bin `i` covers
   * `[start + i * binSize, start + (i + 1) * binSize)`.
   */
  bins: number[]
}

/**
 * Round a bin size up to a "nice" number (1, 2, or 5 times a power of ten), so
 * that bins at similar zoom levels line up and can be reused.
 */
export function niceBinSize(approximateBinSize: number): number {
  if (!(approximateBinSize > 1)) {
    return 1
  }
  const magnitude = 10 ** Math.floor(Math.log10(approximateBinSize))
  for (const multiple of [1, 2, 5]) {
    if (multiple * magnitude >= approximateBinSize) {
      return multiple * magnitude
    }
  }
  return 10 * magnitude
}

/**
 * Expand a region to bin boundaries.
 * @returns the start of the first bin and the number of bins
 */
export function alignBins(start: number, end: number, binSize: number) {
  const alignedStart = Math.floor(start / binSize) * binSize
  const alignedEnd = Math.ceil(end / binSize) * binSize
  return {
    start: alignedStart,
    nBins: Math.max(0, (alignedEnd - alignedStart) / binSize),
  }
}

/**
 * Find which bins a feature overlaps.
 * @returns `[first, last + 1]`, clipped to `[0, nBins]`. The range is empty if
 * the feature doesn't overlap any bin.
 */
export function binRange(
  min: number,
  max: number,
  start: number,
  binSize: number,
  nBins: number,
): [number, number] {
  // Zero-length features (e.g. insertion sites) still occupy one base's bin
  const featureEnd = Math.max(max, min + 1)
  const first = Math.max(0, Math.floor((min - start) / binSize))
  const last = Math.min(
    nBins - 1,
    Math.floor((featureEnd - 1 - start) / binSize),
  )
  return [first, Math.max(first, last + 1)]
}

/**
 * Turn per-bin counts of where features begin and end into the number of
 * features overlapping each bin.
 * @param firstBins - `[bin, count]` pairs: how many features start in each bin
 * @param endBins - `[bin, count]` pairs: how many features end in the bin
 * before each bin
 */
export function coverageFromBoundaries(
  firstBins: Iterable<[number, number]>,
  endBins: Iterable<[number, number]>,
  nBins: number,
): number[] {
  const deltas = Array.from({ length: nBins + 1 }, () => 0)
  for (const [bin, count] of firstBins) {
    deltas[bin] += count
  }
  for (const [bin, count] of endBins) {
    deltas[bin] -= count
  }
  const bins: number[] = []
  let coverage = 0
  for (let i = 0; i < nBins; i++) {
    coverage += deltas[i]
    bins.push(coverage)
  }
  return bins
}

/**
 * Compute a {@link FeatureDensity} from features in memory. The features may
 * include ones outside the region; those are ignored.
 */
export function computeFeatureDensity(
  features: Iterable<{ min: number; max: number }>,
  start: number,
  end: number,
  binSize: number,
): FeatureDensity {
  const aligned = alignBins(start, end, binSize)
  const firstBins: [number, number][] = []
  const endBins: [number, number][] = []
  let count = 0
  for (const { max, min } of features) {
    if (min < end && max > start) {
      count++
    }
    const [first, endBin] = binRange(
      min,
      max,
      aligned.start,
      binSize,
      aligned.nBins,
    )
    if (endBin > first) {
      firstBins.push([first, 1])
      endBins.push([endBin, 1])
    }
  }
  return {
    count,
    start: aligned.start,
    binSize,
    bins: coverageFromBoundaries(firstBins, endBins, aligned.nBins),
  }
}
