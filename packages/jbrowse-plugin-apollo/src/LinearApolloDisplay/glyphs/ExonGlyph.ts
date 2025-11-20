import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

import type { LinearApolloDisplay } from '../stateModel'

import type { Glyph } from './Glyph'
import { getLeftPx, strokeRectInner } from './util'

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  exon: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight, canvasPatterns, lgv, theme } = display
  const { bpPerPx } = lgv
  const left = Math.round(getLeftPx(display, exon, block))
  const width = Math.round(exon.length / bpPerPx)
  const height = Math.round(0.6 * apolloRowHeight)
  const halfHeight = Math.round(height / 2)
  const top = Math.round(halfHeight / 2) + row * apolloRowHeight
  if (width > 2) {
    ctx.fillStyle = 'rgb(211,211,211)'
    ctx.fillRect(left, top, width, height)
    const forwardFill = canvasPatterns.forward
    const backwardFill = canvasPatterns.backward
    const { strand } = exon
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
  strokeRectInner(ctx, left, top, width, height, theme.palette.text.primary)
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

export const exonGlyph: Glyph = {
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
