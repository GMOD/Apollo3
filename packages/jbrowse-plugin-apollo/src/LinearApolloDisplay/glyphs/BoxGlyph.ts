import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { alpha } from '@mui/material'

import {
  type MousePosition,
  type MousePositionWithFeature,
  getContextMenuItemsForFeature,
  isMousePositionWithFeature,
  isSelectedFeature,
} from '../../util'
import type { LinearApolloDisplay } from '../stateModel'
import type { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import type { LinearApolloDisplayRendering } from '../stateModel/rendering'
import type { CanvasMouseEvent } from '../types'

import type { Glyph } from './Glyph'
import { getLeftPx, strokeRectInner } from './util'

/** @returns undefined if mouse not on the edge of this feature, otherwise 'start' or 'end' depending on which edge */
function isMouseOnFeatureEdge(
  mousePosition: MousePosition,
  feature: AnnotationFeature,
  stateModel: LinearApolloDisplay,
) {
  const { refName, regionNumber, x } = mousePosition
  const { lgv } = stateModel
  const { offsetPx } = lgv
  const minPxInfo = lgv.bpToPx({ refName, coord: feature.min, regionNumber })
  const maxPxInfo = lgv.bpToPx({ refName, coord: feature.max, regionNumber })
  if (minPxInfo !== undefined && maxPxInfo !== undefined) {
    const minPx = minPxInfo.offsetPx - offsetPx
    const maxPx = maxPxInfo.offsetPx - offsetPx
    if (Math.abs(maxPx - minPx) < 8) {
      return
    }
    if (Math.abs(minPx - x) < 4) {
      return 'min'
    }
    if (Math.abs(maxPx - x) < 4) {
      return 'max'
    }
  }
  return
}

function drawHighlight(
  stateModel: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  selected = false,
) {
  const { apolloRowHeight, lgv, theme } = stateModel
  const position = stateModel.getFeatureLayoutPosition(feature)
  if (!position) {
    return
  }
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const { layoutIndex, layoutRow } = position
  const displayedRegion = displayedRegions[layoutIndex]
  const { refName, reversed } = displayedRegion
  const { length, max, min } = feature
  const startPx =
    (lgv.bpToPx({
      refName,
      coord: reversed ? max : min,
      regionNumber: layoutIndex,
    })?.offsetPx ?? 0) - offsetPx
  const top = layoutRow * apolloRowHeight
  const widthPx = length / bpPerPx
  ctx.fillStyle = selected
    ? theme.palette.action.disabled
    : theme.palette.action.focus
  ctx.fillRect(startPx, top, widthPx, apolloRowHeight)
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight, lgv, selectedFeature, theme } = display
  const { bpPerPx } = lgv
  const left = Math.round(getLeftPx(display, feature, block))
  const top = row * apolloRowHeight
  const width = Math.round(feature.length / bpPerPx)
  const height = apolloRowHeight
  if (width > 2) {
    ctx.fillStyle = theme.palette.background.default
    ctx.fillRect(left, top, width, apolloRowHeight)
  }
  strokeRectInner(ctx, left, top, width, height, theme.palette.text.primary)

  if (isSelectedFeature(feature, selectedFeature)) {
    drawHighlight(display, ctx, feature, true)
  }
}

function drawDragPreview(
  stateModel: LinearApolloDisplay,
  overlayCtx: CanvasRenderingContext2D,
) {
  const { apolloDragging, apolloRowHeight, lgv, theme } = stateModel
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  if (!apolloDragging) {
    return
  }
  const { current, edge, feature, start } = apolloDragging

  const row = Math.floor(start.y / apolloRowHeight)
  const region = displayedRegions[start.regionNumber]
  const rowCount = getRowCount()

  const featureEdgeBp = region.reversed
    ? region.end - feature[edge]
    : feature[edge] - region.start
  const featureEdgePx = featureEdgeBp / bpPerPx - offsetPx
  const rectX = Math.min(current.x, featureEdgePx)
  const rectY = row * apolloRowHeight
  const rectWidth = Math.abs(current.x - featureEdgePx)
  const rectHeight = apolloRowHeight * rowCount
  overlayCtx.strokeStyle = theme.palette.info.main
  overlayCtx.setLineDash([6])
  overlayCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
  overlayCtx.fillStyle = alpha(theme.palette.info.main, 0.2)
  overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight)
}

function drawHover(
  stateModel: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
) {
  const { hoveredFeature } = stateModel
  if (!hoveredFeature) {
    return
  }
  drawHighlight(stateModel, ctx, hoveredFeature.feature)
}

function drawTooltip(
  display: LinearApolloDisplayMouseEvents,
  context: CanvasRenderingContext2D,
): void {
  const { hoveredFeature, apolloRowHeight, lgv, theme } = display
  if (!hoveredFeature) {
    return
  }
  const { feature } = hoveredFeature
  const position = display.getFeatureLayoutPosition(feature)
  if (!position) {
    return
  }
  const { featureRow, layoutIndex, layoutRow } = position
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[layoutIndex]
  const { refName, reversed } = displayedRegion

  let location = 'Loc: '

  const { length, max, min } = feature
  location += `${min + 1}–${max}`

  let startPx =
    (lgv.bpToPx({
      refName,
      coord: reversed ? max : min,
      regionNumber: layoutIndex,
    })?.offsetPx ?? 0) - offsetPx
  const top = (layoutRow + featureRow) * apolloRowHeight
  const widthPx = length / bpPerPx

  const featureType = `Type: ${feature.type}`
  const { attributes } = feature
  const featureName = attributes.get('gff_name')?.find((name) => name !== '')
  const textWidth = [
    context.measureText(featureType).width,
    context.measureText(location).width,
  ]
  if (featureName) {
    textWidth.push(context.measureText(`Name: ${featureName}`).width)
  }
  const maxWidth = Math.max(...textWidth)

  startPx = startPx + widthPx + 5
  context.fillStyle = alpha(theme.palette.text.primary, 0.7)
  context.fillRect(startPx, top, maxWidth + 4, textWidth.length === 3 ? 45 : 35)
  context.beginPath()
  context.moveTo(startPx, top)
  context.lineTo(startPx - 5, top + 5)
  context.lineTo(startPx, top + 10)
  context.fill()
  context.fillStyle = theme.palette.background.default
  let textTop = top + 12
  context.fillText(featureType, startPx + 2, textTop)
  if (featureName) {
    textTop = textTop + 12
    context.fillText(`Name: ${featureName}`, startPx + 2, textTop)
  }
  textTop = textTop + 12
  context.fillText(location, startPx + 2, textTop)
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

function getFeatureFromLayout(
  feature: AnnotationFeature,
  _bp: number,
  _row: number,
): AnnotationFeature {
  return feature
}

function getRowCount() {
  return 1
}

function getRowForFeature(
  _feature: AnnotationFeature,
  _childFeature: AnnotationFeature,
): number | undefined {
  return 0
}

function onMouseDown(
  stateModel: LinearApolloDisplay,
  currentMousePosition: MousePositionWithFeature,
  event: CanvasMouseEvent,
) {
  const { feature } = currentMousePosition
  // swallow the mouseDown if we are on the edge of the feature so that we
  // don't start dragging the view if we try to drag the feature edge
  const edge = isMouseOnFeatureEdge(currentMousePosition, feature, stateModel)
  if (edge) {
    event.stopPropagation()
    stateModel.startDrag(currentMousePosition, feature, edge)
  }
}

function onMouseLeave(): void {
  return
}

function onMouseMove(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePosition,
) {
  if (isMousePositionWithFeature(mousePosition)) {
    const { feature, bp } = mousePosition
    stateModel.setHoveredFeature({ feature, bp })
    const edge = isMouseOnFeatureEdge(mousePosition, feature, stateModel)
    if (edge) {
      stateModel.setCursor('col-resize')
      return
    }
  }
  stateModel.setCursor()
}

function onMouseUp(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePosition,
) {
  if (stateModel.apolloDragging) {
    return
  }
  const { feature } = mousePosition
  if (!feature) {
    return
  }
  stateModel.setSelectedFeature(feature)
  stateModel.showFeatureDetailsWidget(feature)
}

export const boxGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  drawTooltip,
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
