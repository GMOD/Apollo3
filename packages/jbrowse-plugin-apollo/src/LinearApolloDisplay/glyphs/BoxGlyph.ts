import { type AnnotationFeature } from '@apollo-annotation/mst'
import { type MenuItem } from '@jbrowse/core/ui'
import { type ContentBlock } from '@jbrowse/core/util/blockTypes'
import { alpha } from '@mui/material'

import {
  type MousePosition,
  type MousePositionWithFeature,
  getContextMenuItemsForFeature,
  isMousePositionWithFeature,
  isSelectedFeature,
} from '../../util'
import { type LinearApolloDisplay } from '../stateModel'
import { type LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import { type LinearApolloDisplayRendering } from '../stateModel/rendering'
import { type CanvasMouseEvent } from '../types'

import { type Glyph } from './Glyph'

function drawBoxOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  drawBox(ctx, x, y, width, height, color)
  if (width <= 2) {
    return
  }
  ctx.clearRect(x + 1, y + 1, width - 2, height - 2)
}

function drawBoxFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  drawBox(ctx, x + 1, y + 1, width - 2, height - 2, color)
}

function getLeftPx(
  display: LinearApolloDisplayRendering,
  feature: AnnotationFeature,
  block: ContentBlock,
) {
  const { lgv } = display
  const { bpPerPx, offsetPx } = lgv
  const blockLeftPx = block.offsetPx - offsetPx
  const featureLeftBpDistanceFromBlockLeftBp = block.reversed
    ? block.end - feature.max
    : feature.min - block.start
  const featureLeftPxDistanceFromBlockLeftPx =
    featureLeftBpDistanceFromBlockLeftBp / bpPerPx
  return blockLeftPx + featureLeftPxDistanceFromBlockLeftPx
}

function draw(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight: heightPx, lgv, selectedFeature, theme } = display
  const { bpPerPx } = lgv
  const leftPx = getLeftPx(display, feature, block)
  const widthPx = feature.length / bpPerPx
  const top = row * heightPx
  const backgroundColor = theme.palette.background.default
  const textColor = theme.palette.text.primary
  const featureBox: [number, number, number, number] = [
    leftPx,
    top,
    widthPx,
    heightPx,
  ]
  drawBoxOutline(ctx, ...featureBox, textColor)
  if (widthPx <= 2) {
    // Don't need to add details if the feature is too small to see them
    return
  }

  drawBoxFill(ctx, leftPx, top, widthPx, heightPx, backgroundColor)
  if (isSelectedFeature(feature, selectedFeature)) {
    drawHighlight(display, ctx, feature, row, block, true)
  }
}

function drawDragPreview(
  display: LinearApolloDisplayMouseEvents,
  overlayCtx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloDragging, apolloRowHeight, lgv, theme } = display
  const { bpPerPx } = lgv
  if (!apolloDragging) {
    return
  }
  const { current, edge } = apolloDragging

  const rowCount = getRowCount(feature)

  const leftPx = getLeftPx(display, feature, block)
  let featureEdgePx
  if (block.reversed) {
    featureEdgePx = edge === 'min' ? leftPx + feature.length / bpPerPx : leftPx
  } else {
    featureEdgePx = edge === 'min' ? leftPx : leftPx + feature.length / bpPerPx
  }
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

function drawHighlight(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
  selected = false,
) {
  const { apolloRowHeight, lgv, theme } = display
  const { bpPerPx } = lgv
  const { length } = feature
  const leftPx = getLeftPx(display, feature, block)
  const top = row * apolloRowHeight
  const widthPx = length / bpPerPx
  drawBox(
    ctx,
    leftPx,
    top,
    widthPx,
    apolloRowHeight,
    selected ? theme.palette.action.disabled : theme.palette.action.focus,
  )
}

function drawHover(
  stateModel: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  drawHighlight(stateModel, ctx, feature, row, block)
}

function drawTooltip(
  display: LinearApolloDisplayMouseEvents,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
): void {
  const { apolloRowHeight, lgv, theme } = display
  const { bpPerPx } = lgv
  let leftPx = getLeftPx(display, feature, block)

  let location = 'Loc: '

  const { length, max, min } = feature
  location += `${min + 1}–${max}`
  const top = row * apolloRowHeight
  const widthPx = length / bpPerPx

  const featureType = `Type: ${feature.type}`
  const { attributes } = feature
  const featureName = attributes.get('gff_name')?.find((name) => name !== '')
  const textWidth = [
    ctx.measureText(featureType).width,
    ctx.measureText(location).width,
  ]
  if (featureName) {
    textWidth.push(ctx.measureText(`Name: ${featureName}`).width)
  }
  const maxWidth = Math.max(...textWidth)

  leftPx = leftPx + widthPx + 5
  ctx.fillStyle = alpha(theme.palette.text.primary, 0.7)
  ctx.fillRect(leftPx, top, maxWidth + 4, textWidth.length === 3 ? 45 : 35)
  ctx.beginPath()
  ctx.moveTo(leftPx, top)
  ctx.lineTo(leftPx - 5, top + 5)
  ctx.lineTo(leftPx, top + 10)
  ctx.fill()
  ctx.fillStyle = theme.palette.background.default
  let textTop = top + 12
  ctx.fillText(featureType, leftPx + 2, textTop)
  if (featureName) {
    textTop = textTop + 12
    ctx.fillText(`Name: ${featureName}`, leftPx + 2, textTop)
  }
  textTop = textTop + 12
  ctx.fillText(location, leftPx + 2, textTop)
}

export function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, width, height)
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

function getRowCount(_feature: AnnotationFeature) {
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
