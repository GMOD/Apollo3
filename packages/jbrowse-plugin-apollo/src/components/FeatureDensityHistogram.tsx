import { type FeatureDensity, niceBinSize } from '@apollo-annotation/shared'
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
        bars.push({
          key: `${block.key}-${idx}-${binIdx}`,
          x: blockLeftPx + leftBp / bpPerPx,
          width: (end - start) / bpPerPx,
          count,
          assemblyName: block.assemblyName,
          refName: block.refName,
          start: binStart,
          end: binEnd,
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
export function getScaleTicks(maxCount: number) {
  const step = niceBinSize(maxCount / 4)
  const scaleMax = Math.max(step, Math.ceil(maxCount / step) * step)
  const ticks: number[] = []
  for (let tick = 0; tick <= scaleMax; tick += step) {
    ticks.push(tick)
  }
  return { scaleMax, ticks }
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
    const maxCount = Math.max(1, ...bars.map((bar) => bar.count))
    const { scaleMax, ticks } = getScaleTicks(maxCount)

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
        </div>
        <div className={classes.plot} style={{ width: totalWidthPx }}>
          <Tooltip
            followCursor
            title={
              hovered
                ? `${hovered.refName}:${(hovered.start + 1).toLocaleString()}-${hovered.end.toLocaleString()}: ${hovered.count.toLocaleString()} feature${hovered.count === 1 ? '' : 's'} (click to zoom in)`
                : ''
            }
          >
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
                const height = (bar.count / scaleMax) * plotHeight
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
                    <rect
                      x={bar.x}
                      y={plotHeight - height}
                      width={Math.max(bar.width - 0.5, 0.5)}
                      height={height}
                      fill={
                        hovered?.key === bar.key
                          ? theme.palette.secondary.main
                          : theme.palette.primary.main
                      }
                    />
                  </g>
                )
              })}
            </svg>
          </Tooltip>
          <div className={classes.scale} data-testid="feature-density-scale">
            {ticks.map((tick) => {
              // Keep the end labels inside the plot
              let shift = '50%'
              if (tick === 0) {
                shift = '0%'
              } else if (tick === scaleMax) {
                shift = '100%'
              }
              return (
                <div
                  key={tick}
                  className={classes.tick}
                  style={{
                    bottom: `${(tick / scaleMax) * 100}%`,
                    transform: `translateY(${shift})`,
                  }}
                >
                  <span className={classes.tickLabel}>
                    {tick.toLocaleString()}
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
