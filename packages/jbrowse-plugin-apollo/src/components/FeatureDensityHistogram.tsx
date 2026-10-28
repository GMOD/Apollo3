import type { FeatureDensity } from '@apollo-annotation/shared'
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

/** Height of the histogram, in px */
export const densityHistogramHeight = 80
/** Space above the bars for the banner, in px */
const bannerHeight = 24

const useStyles = makeStyles()((theme) => ({
  container: {
    position: 'relative',
    height: densityHistogramHeight,
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
    cursor: 'zoom-in',
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
    const plotHeight = densityHistogramHeight - bannerHeight

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
          <span style={{ color: theme.palette.text.secondary }}>
            (max {maxCount.toLocaleString()} per bar)
          </span>
        </div>
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
            height={densityHistogramHeight}
            onMouseLeave={() => {
              setHovered(undefined)
            }}
          >
            {bars.map((bar) => {
              const height = (bar.count / maxCount) * plotHeight
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
                    y={bannerHeight}
                    width={bar.width}
                    height={plotHeight}
                    fill="transparent"
                  />
                  <rect
                    x={bar.x}
                    y={densityHistogramHeight - height}
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
      </div>
    )
  },
)
