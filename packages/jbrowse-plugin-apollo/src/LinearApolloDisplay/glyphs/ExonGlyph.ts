import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

import { type MousePositionWithFeature, isSelectedFeature } from '../../util'
import type { LinearApolloDisplay } from '../stateModel'
import type { CanvasMouseEvent } from '../types'

import { boxGlyph } from './BoxGlyph'
import type { Glyph } from './Glyph'
import {
  drawHighlight,
  getFeatureBox,
  isMouseOnFeatureEdge,
  strokeRectInner,
} from './util'

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  exon: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight, canvasPatterns, selectedFeature, theme } = display
  const [, left, width] = getFeatureBox(display, exon, row, block)
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
  if (isSelectedFeature(exon, selectedFeature)) {
    drawHighlight(display, ctx, left, top, width, height, true)
  }
}

function drawHover(
  display: LinearApolloDisplay,
  overlayCtx: CanvasRenderingContext2D,
  exon: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight } = display
  const [, left, width] = getFeatureBox(display, exon, row, block)
  const height = Math.round(0.6 * apolloRowHeight)
  const halfHeight = Math.round(height / 2)
  const top = Math.round(halfHeight / 2) + row * apolloRowHeight
  drawHighlight(display, overlayCtx, left, top, width, height)
}

function drawDragPreview() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// ctx: CanvasRenderingContext2D,

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

function onMouseDown(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePositionWithFeature,
  event: CanvasMouseEvent,
) {
  const { feature } = mousePosition
  // swallow the mouseDown if we are on the edge of the feature so that we
  // don't start dragging the view if we try to drag the feature edge
  const edge = isMouseOnFeatureEdge(mousePosition, feature, stateModel)
  if (edge) {
    event.stopPropagation()
    stateModel.startDrag(mousePosition, feature, edge, true)
  }
}

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const { onMouseMove, onMouseLeave, onMouseUp } = boxGlyph
/* eslint-enable @typescript-eslint/unbound-method */

export const exonGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
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
