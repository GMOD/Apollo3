import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { alpha } from '@mui/material'

import { getContextMenuItemsForFeature, isSelectedFeature } from '../../util'
import type { LinearApolloDisplay } from '../stateModel'
import type { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'

import type { Glyph } from './Glyph'
import { drawHighlight, getFeatureBox, strokeRectInner } from './util'

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  rowInFeature: number,
  block: ContentBlock,
) {
  const { selectedFeature, theme } = display
  const [top, left, width, height] = getFeatureBox(display, feature, row, block)
  if (width > 2) {
    ctx.fillStyle = theme.palette.background.default
    ctx.fillRect(left, top, width, height)
  }
  strokeRectInner(ctx, left, top, width, height, theme.palette.text.primary)
  if (isSelectedFeature(feature, selectedFeature)) {
    drawHighlight(display, ctx, left, top, width, height, true)
  }
}

function drawHover(
  display: LinearApolloDisplay,
  overlayCtx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const [top, left, width, height] = getFeatureBox(display, feature, row, block)
  drawHighlight(display, overlayCtx, left, top, width, height)
}

function drawDragPreview(
  display: LinearApolloDisplay,
  overlayCtx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloDragging, theme } = display
  if (!apolloDragging) {
    return
  }
  const { current, start } = apolloDragging
  const min = Math.min(current.bp, start.bp)
  const max = Math.max(current.bp, start.bp)

  const [top, left, width, height] = getFeatureBox(
    display,
    { min, max },
    row,
    block,
  )

  overlayCtx.fillStyle = alpha(theme.palette.info.main, 0.2)
  overlayCtx.fillRect(left, top, width, height)

  overlayCtx.setLineDash([6])
  strokeRectInner(overlayCtx, left, top, width, height, theme.palette.info.main)
}

function getLayout(display: LinearApolloDisplay, feature: AnnotationFeature) {
  return {
    byFeature: new Map([[feature._id, 0]]),
    byRow: [[{ feature, rowInFeature: 0 }]],
    min: feature.min,
    max: feature.max,
  }
}

function getContextMenuItems(
  display: LinearApolloDisplayMouseEvents,
): MenuItem[] {
  const { hoveredFeature } = display
  if (!hoveredFeature) {
    return []
  }
  return getContextMenuItemsForFeature(display, hoveredFeature.feature)
}

export const boxGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  getContextMenuItems,
  getLayout,
  isDraggable: true,
}
