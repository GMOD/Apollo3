import {
  type DensityStrand,
  type FeatureDensity,
  densityStrands,
  niceBinSize,
} from '@apollo-annotation/shared'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Button, CircularProgress, Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import type {
  DensityStats,
  DisplayMode,
  ThresholdMode,
} from '../util/featureDensityModel'

/** Same as JBrowse's alignments strand colors */
const strandColors: Record<DensityStrand, string> = {
  forward: '#EC8B8B',
  reverse: '#8F8FD8',
  unstranded: '#999999',
}

const strandLabels: Record<DensityStrand, string> = {
  forward: '+',
  reverse: '−',
  unstranded: 'no strand',
}

/** Space above the bars for the banner, in px */
const bannerHeight = 24
/**
 * Height of the plot in SVG user units. The SVG is stretched vertically to
 * fill the track, so bar heights are fractions of this.
 */
const plotHeight = 100

const useStyles = makeStyles()((theme) => ({
  container: {
    position: 'relative',
    height: '100%',
  },
  plot: {
    position: 'absolute',
    left: 0,
    top: bannerHeight,
    bottom: 0,
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    cursor: 'zoom-in',
  },
  scale: {
    position: 'absolute',
    // On the right, like the banner, since JBrowse's track label overlaps the
    // left
    right: 0,
    top: 0,
    bottom: 0,
    borderRight: `1px solid ${theme.palette.text.secondary}`,
    pointerEvents: 'none',
  },
  tick: {
    position: 'absolute',
    right: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    fontSize: 10,
    lineHeight: 1,
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
  },
  tickMark: {
    width: 4,
    borderTop: `1px solid ${theme.palette.text.secondary}`,
  },
  legendSwatch: {
    display: 'inline-block',
    width: 8,
    height: 8,
    marginRight: 2,
  },
  tickLabel: {
    padding: '0 2px',
    background: theme.palette.background.paper,
    opacity: 0.85,
  },
  banner: {
    position: 'absolute',
    top: 0,
    // On the right, since JBrowse's track label overlaps the left
    right: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 1),
    height: bannerHeight,
    fontSize: theme.typography.caption.fontSize,
    background: theme.palette.background.paper,
    opacity: 0.9,
    zIndex: 1,
    whiteSpace: 'nowrap',
  },
}))

export interface Bar {
  key: string
  x: number
  width: number
  count: number
  assemblyName: string
  refName: string
  start: number
  end: number
  /** `count` split by strand, if the backend provides it */
  strandCounts?: Record<DensityStrand, number>
}

export interface FeatureDensityHistogramModel {
  densityLgv: LinearGenomeViewModel
  densityStats?: DensityStats
  displayMode: DisplayMode
  featureCountInView?: number
  maxFeatureCountSetting: number
  thresholdModeSetting: ThresholdMode
  zoomThresholdSetting: number
  forceLoadFeatures: () => void
}

/**
 * Lay out the bins of each density over the content blocks of the view. The
 * densities may be from a slightly earlier view (e.g. while scrolling), so
 * they're matched to blocks by reference sequence instead of by index.
 */
export function getDensityBars(
  lgv: Pick<LinearGenomeViewModel, 'bpPerPx' | 'offsetPx' | 'dynamicBlocks'>,
  densities: FeatureDensity[],
  regions: { assemblyName: string; refName: string }[],
) {
  const { bpPerPx, offsetPx } = lgv
  const bars: Bar[] = []
  for (const block of lgv.dynamicBlocks.contentBlocks) {
    const blockLeftPx = block.offsetPx - offsetPx
    for (const [idx, density] of densities.entries()) {
      const region = regions[idx]
      if (
        region.assemblyName !== block.assemblyName ||
        region.refName !== block.refName
      ) {
        continue
      }
      for (const [binIdx, count] of density.bins.entries()) {
        const binStart = density.start + binIdx * density.binSize
        const binEnd = binStart + density.binSize
        const start = Math.max(binStart, block.start)
        const end = Math.min(binEnd, block.end)
        if (end <= start) {
          continue
        }
        const leftBp = block.reversed ? block.end - end : start - block.start
        const { strandBins } = density
        bars.push({
          key: `${block.key}-${idx}-${binIdx}`,
          x: blockLeftPx + leftBp / bpPerPx,
          width: (end - start) / bpPerPx,
          count,
          assemblyName: block.assemblyName,
          refName: block.refName,
          start: binStart,
          end: binEnd,
          strandCounts: strandBins && {
            forward: strandBins.forward[binIdx],
            reverse: strandBins.reverse[binIdx],
            unstranded: strandBins.unstranded[binIdx],
          },
        })
      }
    }
  }
  return bars
}

/**
 * Pick the top of the count scale and the tick values on it. The top is
 * rounded up to a whole number of "nice" (1/2/5 × 10ⁿ) steps, so it gets a
 * label too.
 */
export function getScaleTicks(maxCount: number, divisions = 4) {
  const step = niceBinSize(maxCount / divisions)
  const scaleMax = Math.max(step, Math.ceil(maxCount / step) * step)
  const ticks: number[] = []
  for (let tick = 0; tick <= scaleMax; tick += step) {
    ticks.push(tick)
  }
  return { scaleMax, ticks }
}

function tooltipText(bar: Bar) {
  const { count, end, refName, start, strandCounts } = bar
  const range = `${refName}:${(start + 1).toLocaleString()}-${end.toLocaleString()}`
  let text = `${range}: ${count.toLocaleString()} feature${count === 1 ? '' : 's'}`
  if (strandCounts && count > 0) {
    const byStrand = densityStrands
      .filter((strand) => strandCounts[strand] > 0)
      .map(
        (strand) =>
          `${strandLabels[strand]} ${strandCounts[strand].toLocaleString()}`,
      )
    text += ` (${byStrand.join(', ')})`
  }
  return `${text} (click to zoom in)`
}

/**
 * How far a bar reaches from the baseline: the whole count, or when mirrored,
 * the larger of the + side and the − side (each with half the unstranded
 * features)
 */
function getBarExtent(bar: Bar, mirrored: boolean) {
  if (!mirrored) {
    return bar.count
  }
  const { forward, reverse, unstranded } = getStrandCounts(bar)
  return Math.max(forward, reverse) + unstranded / 2
}

function getStrandCounts(bar: Bar) {
  // Treat counts without strand information as unstranded
  return bar.strandCounts ?? { forward: 0, reverse: 0, unstranded: bar.count }
}

/**
 * Split a bar into segments. Without strand information, a single segment
 * grows up from the bottom. Mirrored, + grows up and − grows down from the
 * middle, and each side ends with half of the unstranded features.
 * @returns segments with `y` (bottom edge, from the bottom of the plot) and
 * `height` as fractions of the plot height
 */
export function getBarSegments(
  bar: Bar,
  scaleMax: number,
  mirrored: boolean,
  defaultColor: string,
) {
  if (!mirrored) {
    return [
      { key: 'all', color: defaultColor, y: 0, height: bar.count / scaleMax },
    ]
  }
  const perCount = 0.5 / scaleMax
  const { forward, reverse, unstranded } = getStrandCounts(bar)
  const forwardHeight = forward * perCount
  const reverseHeight = reverse * perCount
  const unstrandedHeight = (unstranded / 2) * perCount
  const { forward: forwardColor, reverse: reverseColor } = strandColors
  return [
    { key: 'forward', color: forwardColor, y: 0.5, height: forwardHeight },
    {
      key: 'unstranded-up',
      color: strandColors.unstranded,
      y: 0.5 + forwardHeight,
      height: unstrandedHeight,
    },
    {
      key: 'reverse',
      color: reverseColor,
      y: 0.5 - reverseHeight,
      height: reverseHeight,
    },
    {
      key: 'unstranded-down',
      color: strandColors.unstranded,
      y: 0.5 - reverseHeight - unstrandedHeight,
      height: unstrandedHeight,
    },
  ].filter((segment) => segment.height > 0)
}

/**
 * Place the scale's ticks. Mirrored, 0 is in the middle and the ticks repeat
 * above and below it.
 * @returns ticks with `position` as a fraction of the plot height from the
 * bottom
 */
export function getTickPositions(
  ticks: number[],
  scaleMax: number,
  mirrored: boolean,
) {
  if (!mirrored) {
    return ticks.map((value) => ({
      key: String(value),
      value,
      position: value / scaleMax,
    }))
  }
  return ticks.flatMap((value) => {
    const offset = (value / scaleMax) * 0.5
    const up = { key: `+${value}`, value, position: 0.5 + offset }
    return value === 0
      ? [up]
      : [up, { key: `-${value}`, value, position: 0.5 - offset }]
  })
}

function bannerText(model: FeatureDensityHistogramModel) {
  const { featureCountInView, thresholdModeSetting, zoomThresholdSetting } =
    model
  if (thresholdModeSetting === 'fixed') {
    return `Showing feature density when zoomed out past ${zoomThresholdSetting.toLocaleString()} bp/px`
  }
  if (featureCountInView === undefined) {
    return 'Showing feature density'
  }
  return `Showing feature density: ${featureCountInView.toLocaleString()} features in view`
}

export const FeatureDensityHistogram = observer(
  function FeatureDensityHistogram({
    model,
  }: {
    model: FeatureDensityHistogramModel
  }) {
    const { classes } = useStyles()
    const theme = useTheme()
    const [hovered, setHovered] = useState<Bar>()
    const { densityLgv: lgv, densityStats, displayMode } = model
    const { totalWidthPx } = lgv.dynamicBlocks

    if (displayMode === 'pending' || !densityStats) {
      return (
        <div className={classes.container} style={{ width: totalWidthPx }}>
          <div className={classes.banner}>
            <CircularProgress size={12} />
            Counting features in view…
          </div>
        </div>
      )
    }

    const bars = getDensityBars(
      lgv,
      densityStats.densities,
      densityStats.regions,
    )
    const hasStrands = bars.some((bar) => bar.strandCounts)
    const maxExtent = Math.max(
      1,
      ...bars.map((bar) => getBarExtent(bar, hasStrands)),
    )
    // Each half of a mirrored plot has half the room for ticks
    const { scaleMax, ticks } = getScaleTicks(maxExtent, hasStrands ? 2 : 4)

    return (
      <div
        className={classes.container}
        style={{ width: totalWidthPx }}
        data-testid="feature-density-histogram"
      >
        <div className={classes.banner}>
          <span>{bannerText(model)}. Zoom in to see features, or</span>
          <Button
            size="small"
            variant="outlined"
            style={{ padding: '0 4px', minWidth: 0, fontSize: 'inherit' }}
            onClick={() => {
              model.forceLoadFeatures()
            }}
          >
            show them anyway
          </Button>
          {hasStrands
            ? densityStrands.map((strand) => (
                <span key={strand}>
                  <span
                    className={classes.legendSwatch}
                    style={{ background: strandColors[strand] }}
                  />
                  {strandLabels[strand]}
                </span>
              ))
            : null}
        </div>
        <div className={classes.plot} style={{ width: totalWidthPx }}>
          <Tooltip followCursor title={hovered ? tooltipText(hovered) : ''}>
            <svg
              className={classes.svg}
              width={totalWidthPx}
              viewBox={`0 0 ${totalWidthPx} ${plotHeight}`}
              preserveAspectRatio="none"
              onMouseLeave={() => {
                setHovered(undefined)
              }}
            >
              {bars.map((bar) => {
                const width = Math.max(bar.width - 0.5, 0.5)
                const segments = getBarSegments(
                  bar,
                  scaleMax,
                  hasStrands,
                  theme.palette.primary.main,
                )
                const bottom = Math.min(...segments.map(({ y }) => y))
                const top = Math.max(
                  ...segments.map(({ height, y }) => y + height),
                )
                return (
                  <g
                    key={bar.key}
                    data-testid="feature-density-bar"
                    data-count={bar.count}
                    onMouseEnter={() => {
                      setHovered(bar)
                    }}
                    onClick={() => {
                      // Zoom in 10x, centered on the bar
                      const center = (bar.start + bar.end) / 2
                      const halfWidth = (lgv.bpPerPx * lgv.width) / 20
                      lgv.navTo({
                        assemblyName: bar.assemblyName,
                        refName: bar.refName,
                        start: Math.max(0, Math.round(center - halfWidth)),
                        end: Math.round(center + halfWidth),
                      })
                    }}
                  >
                    {/* Full-height target so small bars are easy to hover */}
                    <rect
                      x={bar.x}
                      y={0}
                      width={bar.width}
                      height={plotHeight}
                      fill="transparent"
                    />
                    {segments.map((segment) => (
                      <rect
                        key={segment.key}
                        x={bar.x}
                        y={plotHeight * (1 - segment.y - segment.height)}
                        width={width}
                        height={plotHeight * segment.height}
                        fill={segment.color}
                      />
                    ))}
                    {hovered?.key === bar.key ? (
                      <rect
                        x={bar.x}
                        y={plotHeight * (1 - top)}
                        width={width}
                        height={plotHeight * (top - bottom)}
                        fill="none"
                        stroke={theme.palette.text.primary}
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                  </g>
                )
              })}
              {hasStrands ? (
                <line
                  x1={0}
                  x2={totalWidthPx}
                  y1={plotHeight / 2}
                  y2={plotHeight / 2}
                  stroke={theme.palette.text.secondary}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ) : null}
            </svg>
          </Tooltip>
          <div className={classes.scale} data-testid="feature-density-scale">
            {getTickPositions(ticks, scaleMax, hasStrands).map((tick) => {
              // Keep the end labels inside the plot
              let shift = '50%'
              if (tick.position === 0) {
                shift = '0%'
              } else if (tick.position === 1) {
                shift = '100%'
              }
              return (
                <div
                  key={tick.key}
                  className={classes.tick}
                  style={{
                    bottom: `${tick.position * 100}%`,
                    transform: `translateY(${shift})`,
                  }}
                >
                  <span className={classes.tickLabel}>
                    {tick.value.toLocaleString()}
                  </span>
                  <span className={classes.tickMark} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  },
)
