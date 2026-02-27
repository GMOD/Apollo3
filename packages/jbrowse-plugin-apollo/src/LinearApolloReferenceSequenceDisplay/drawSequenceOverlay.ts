import type { AnnotationFeature } from '@apollo-annotation/mst'
import { type Frame, getFrame } from '@jbrowse/core/util'
import type { BlockSet, ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { Theme } from '@mui/material'

import type { ApolloSessionModel, HoveredFeature } from '../session'

function getSeqRow(
  strand: 1 | -1 | undefined,
  bpPerPx: number,
  reversed?: boolean,
): number | undefined {
  if (bpPerPx > 1 || strand === undefined) {
    return
  }
  if (reversed) {
    return strand === 1 ? 4 : 3
  }
  return strand === 1 ? 3 : 4
}

function getTranslationRow(frame: Frame, bpPerPx: number, reversed?: boolean) {
  const frameRows = bpPerPx <= 1 ? [2, 1, 0, 7, 6, 5] : [2, 1, 0, 5, 4, 3]
  if (reversed) {
    frameRows.reverse()
  }
  frameRows.unshift(0)
  const row = frameRows.at(frame)
  if (row === undefined) {
    throw new Error('could not find row')
  }
  return row
}

function getLeftPx(
  feature: { min: number; max: number },
  bpPerPx: number,
  offsetPx: number,
  block: ContentBlock,
) {
  const blockLeftPx = block.offsetPx - offsetPx
  const featureLeftBpDistanceFromBlockLeftBp = block.reversed
    ? block.end - feature.max
    : feature.min - block.start
  const featureLeftPxDistanceFromBlockLeftPx =
    featureLeftBpDistanceFromBlockLeftBp / bpPerPx
  return blockLeftPx + featureLeftPxDistanceFromBlockLeftPx
}

function fillAndStrokeRect(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  theme: Theme,
  selected = false,
) {
  ctx.fillStyle = selected
    ? theme.palette.action.disabled
    : theme.palette.action.focus
  ctx.fillRect(left, top, width, height)
  ctx.strokeStyle = selected
    ? theme.palette.text.secondary
    : theme.palette.text.primary
  ctx.strokeStyle = theme.palette.text.primary
  ctx.strokeRect(left, top, width, height)
}

function drawHighlight(
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  bpPerPx: number,
  offsetPx: number,
  rowHeight: number,
  block: ContentBlock,
  theme: Theme,
  selected = false,
) {
  const row = getSeqRow(feature.strand, bpPerPx, block.reversed)
  if (row === undefined) {
    return
  }
  const left = getLeftPx(feature, bpPerPx, offsetPx, block)
  const width = feature.length / bpPerPx
  const top = row * rowHeight
  fillAndStrokeRect(ctx, left, top, width, rowHeight, theme, selected)
}

function drawCDSHighlight(
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  bpPerPx: number,
  offsetPx: number,
  rowHeight: number,
  block: ContentBlock,
  theme: Theme,
  selected = false,
) {
  const parentFeature = feature.parent
  if (!parentFeature) {
    return
  }
  const cdsLocs = parentFeature.cdsLocations.find((loc) => {
    const min = loc.at(feature.strand === 1 ? 0 : -1)?.min
    const max = loc.at(feature.strand === 1 ? -1 : 0)?.max
    return feature.min === min && feature.max === max
  })
  if (!cdsLocs) {
    return
  }
  for (const loc of cdsLocs) {
    const frame = getFrame(loc.min, loc.max, feature.strand ?? 1, loc.phase)
    const row = getTranslationRow(frame, bpPerPx, block.reversed)
    const left = getLeftPx(loc, bpPerPx, offsetPx, block)
    const top = row * rowHeight
    const width = (loc.max - loc.min) / bpPerPx
    fillAndStrokeRect(ctx, left, top, width, rowHeight, theme, selected)
  }
}

export function drawSequenceOverlay(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  hoveredFeature: HoveredFeature | undefined,
  selectedFeature: AnnotationFeature | undefined,
  rowHeight: number,
  theme: Theme,
  session: ApolloSessionModel,
  bpPerPx: number,
  offsetPx: number,
  dynamicBlocks: BlockSet,
) {
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  for (const block of dynamicBlocks.contentBlocks) {
    ctx.save()
    ctx.beginPath()
    const blockLeftPx = block.offsetPx - offsetPx
    ctx.rect(blockLeftPx, 0, block.widthPx, canvas.height)
    ctx.clip()
    for (const feature of [
      selectedFeature,
      hoveredFeature?.feature,
    ].filter<AnnotationFeature>((f) => f !== undefined)) {
      if (featureTypeOntology.isTypeOf(feature.type, 'CDS')) {
        drawCDSHighlight(
          ctx,
          feature,
          bpPerPx,
          offsetPx,
          rowHeight,
          block,
          theme,
          feature._id === selectedFeature?._id,
        )
      } else {
        drawHighlight(
          ctx,
          feature,
          bpPerPx,
          offsetPx,
          rowHeight,
          block,
          theme,
          feature._id === selectedFeature?._id,
        )
      }
    }
    ctx.restore()
  }
}
