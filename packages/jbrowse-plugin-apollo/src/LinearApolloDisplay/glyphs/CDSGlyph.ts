import type {
  AnnotationFeature,
  TranscriptPartCoding,
} from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import { getFrame } from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

import type { LinearApolloDisplay } from '../stateModel'

import type { Glyph } from './Glyph'
import { getLeftPx, strokeRectInner } from './util'

function drawCDSLocation(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  cdsLocation: TranscriptPartCoding,
  strand: 1 | -1 | undefined,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight, canvasPatterns, lgv, theme } = display
  const { bpPerPx } = lgv
  const left = Math.round(getLeftPx(display, cdsLocation, block))
  const width = Math.round((cdsLocation.max - cdsLocation.min) / bpPerPx)
  const halfHeight = Math.round(apolloRowHeight / 2)
  const top = row * apolloRowHeight
  if (width > 2) {
    const frame = getFrame(
      cdsLocation.min,
      cdsLocation.max,
      strand ?? 1,
      cdsLocation.phase,
    )
    const frameColor = theme.palette.framesCDS.at(frame)?.main
    ctx.fillStyle = frameColor ?? 'black'
    ctx.fillRect(left, top, width, apolloRowHeight)
    const forwardFill = canvasPatterns.forward
    const backwardFill = canvasPatterns.backward
    if (forwardFill && backwardFill && strand) {
      const { reversed } = block
      const reversal = reversed ? -1 : 1
      const [topFill, bottomFill] =
        strand * reversal === 1
          ? [forwardFill, backwardFill]
          : [backwardFill, forwardFill]
      ctx.fillStyle = topFill
      ctx.fillRect(left, top, width, halfHeight)
      ctx.fillStyle = bottomFill
      ctx.fillRect(left, top + halfHeight, width, halfHeight)
    }
  }
  strokeRectInner(
    ctx,
    left,
    top,
    width,
    apolloRowHeight,
    theme.palette.text.primary,
  )
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  cds: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const transcript = cds.parent
  if (!transcript) {
    return
  }
  const { cdsLocations } = transcript
  const thisCDSLocations = cdsLocations.find((loc) => {
    const min = loc.at(cds.strand === 1 ? 0 : -1)?.min
    const max = loc.at(cds.strand === 1 ? -1 : 0)?.max
    return cds.min === min && cds.max === max
  })
  if (!thisCDSLocations) {
    return
  }
  for (const cdsLocation of thisCDSLocations) {
    drawCDSLocation(display, ctx, cdsLocation, cds.strand, row, block)
  }
}

function getRowCount() {
  return 1
}

function getFeatureFromLayout(
  _display: LinearApolloDisplay,
  feature: AnnotationFeature,
  bp: number,
  row: number,
) {
  if (row > 0) {
    return
  }
  if (bp >= feature.min && bp <= feature.max) {
    return feature
  }
  return
}

function getRowForFeature(
  _display: LinearApolloDisplay,
  feature: AnnotationFeature,
  childFeature: AnnotationFeature,
) {
  if (feature._id === childFeature._id) {
    return 0
  }
  return
}

function drawHover() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// overlayCtx: CanvasRenderingContext2D,

function drawDragPreview() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// ctx: CanvasRenderingContext2D,

function onMouseDown() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// currentMousePosition: MousePositionWithFeature,
// event: CanvasMouseEvent,

function onMouseMove() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// currentMousePosition: MousePositionWithFeature,
// event: CanvasMouseEvent,

function onMouseLeave() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// currentMousePosition: MousePositionWithFeature,
// event: CanvasMouseEvent,

function onMouseUp() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// currentMousePosition: MousePositionWithFeature,
// event: CanvasMouseEvent,

function drawTooltip() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// context: CanvasRenderingContext2D,

function getContextMenuItemsForFeature(): MenuItem[] {
  return []
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// sourceFeature: AnnotationFeature,

function getContextMenuItems(): MenuItem[] {
  return []
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// currentMousePosition: MousePositionWithFeature,

export const cdsGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  drawTooltip,
  getContextMenuItems,
  getContextMenuItemsForFeature,
  getFeatureFromLayout,
  getRowCount,
  getRowForFeature,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
}
