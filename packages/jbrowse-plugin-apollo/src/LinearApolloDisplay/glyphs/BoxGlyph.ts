import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { alpha } from '@mui/material'

import {
  type MousePositionWithFeature,
  getContextMenuItemsForFeature,
  isSelectedFeature,
  selectFeatureAndOpenWidget,
} from '../../util'
import type { LinearApolloDisplay } from '../stateModel'
import type { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import type { CanvasMouseEvent } from '../types'

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
  feature: AnnotationFeature,
  row: number,
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

function getContextMenuItems(
  display: LinearApolloDisplayMouseEvents,
): MenuItem[] {
  const { hoveredFeature } = display
  if (!hoveredFeature) {
    return []
  }
  return getContextMenuItemsForFeature(display, hoveredFeature.feature)
}

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
    stateModel.startDrag(mousePosition, feature, edge)
  }
}

function onMouseMove(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePositionWithFeature,
) {
  const { feature, bp } = mousePosition
  stateModel.setHoveredFeature({ feature, bp })
  const edge = isMouseOnFeatureEdge(mousePosition, feature, stateModel)
  if (edge) {
    stateModel.setCursor('col-resize')
    return
  }
  stateModel.setCursor()
}

function onMouseLeave(): void {
  return
}

function onMouseUp(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePositionWithFeature,
) {
  if (stateModel.apolloDragging) {
    return
  }
  const { feature } = mousePosition
  selectFeatureAndOpenWidget(stateModel, feature)
}

export const boxGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  getContextMenuItemsForFeature,
  getContextMenuItems,
  getFeatureFromLayout,
  getRowCount,
  getRowForFeature,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
}
