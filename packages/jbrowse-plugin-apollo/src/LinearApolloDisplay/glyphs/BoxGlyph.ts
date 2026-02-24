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
