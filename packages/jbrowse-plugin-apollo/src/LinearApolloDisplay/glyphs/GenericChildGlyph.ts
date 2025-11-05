import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { alpha } from '@mui/material'

import {
  type MousePositionWithFeature,
  containsSelectedFeature,
  isMousePositionWithFeature,
} from '../../util'
import { getRelatedFeatures } from '../../util/annotationFeatureUtils'
import type { LinearApolloDisplay } from '../stateModel'
import type { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'

import { boxGlyph } from './BoxGlyph'
import type { Glyph } from './Glyph'
import { getLeftPx, strokeRectInner } from './util'

function featuresForRow(feature: AnnotationFeature): AnnotationFeature[][] {
  const features = [[feature]]
  if (feature.children) {
    for (const [, child] of feature.children) {
      features.push(...featuresForRow(child))
    }
  }
  return features
}

function drawHighlight(
  stateModel: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  selected = false,
) {
  const { apolloRowHeight, lgv, theme } = stateModel

  const position = stateModel.getFeatureLayoutPosition(feature)
  if (!position) {
    return
  }
  const { featureRow, layoutIndex, layoutRow } = position
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[layoutIndex]
  const { refName, reversed } = displayedRegion
  const { length, max, min } = feature
  const startPx =
    (lgv.bpToPx({
      refName,
      coord: reversed ? max : min,
      regionNumber: layoutIndex,
    })?.offsetPx ?? 0) - offsetPx
  const top = (layoutRow + featureRow) * apolloRowHeight
  const widthPx = length / bpPerPx
  ctx.fillStyle = selected
    ? theme.palette.action.disabled
    : theme.palette.action.focus
  ctx.fillRect(
    startPx,
    top,
    widthPx,
    apolloRowHeight * getRowCount(stateModel, feature),
  )
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { apolloRowHeight, getGlyph, lgv, selectedFeature, theme } = display
  const { bpPerPx } = lgv
  const left = Math.round(getLeftPx(display, feature, block))
  const top = row * apolloRowHeight
  const width = Math.round(feature.length / bpPerPx)
  const height = getRowCount(display, feature) * apolloRowHeight
  if (width > 2) {
    ctx.fillStyle = alpha(theme.palette.background.paper, 0.6)
    ctx.fillRect(left, top, width, height)
  }
  strokeRectInner(ctx, left, top, width, height, theme.palette.text.primary)
  boxGlyph.draw(display, ctx, feature, row, block)
  strokeRectInner(ctx, left, top, width, height, theme.palette.text.primary)
  const { children } = feature
  if (!children) {
    return
  }
  let rowOffset = 1
  for (const [, child] of children) {
    const glyph = getGlyph(child)
    const rowCount = glyph.getRowCount(display, child)
    glyph.draw(display, ctx, child, row + rowOffset, block)
    rowOffset += rowCount
  }

  if (selectedFeature && containsSelectedFeature(feature, selectedFeature)) {
    drawHighlight(display, ctx, selectedFeature)
  }
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

function getRowCount(display: LinearApolloDisplay, feature: AnnotationFeature) {
  const { children } = feature
  if (!children) {
    return 1
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { getGlyph } = display
  let rowCount = 1
  for (const [, child] of children) {
    const glyph = getGlyph(feature)
    rowCount += glyph.getRowCount(display, child)
  }
  return rowCount
}

function getFeatureFromLayout(
  feature: AnnotationFeature,
  bp: number,
  row: number,
) {
  const layoutRow = featuresForRow(feature)[row]
  return layoutRow.find((f) => bp >= f.min && bp <= f.max)
}

function getRowForFeature(
  feature: AnnotationFeature,
  childFeature: AnnotationFeature,
) {
  const rows = featuresForRow(feature)
  for (const [idx, row] of rows.entries()) {
    if (row.some((feature) => feature._id === childFeature._id)) {
      return idx
    }
  }
  return
}

function getContextMenuItems(
  display: LinearApolloDisplayMouseEvents,
  mousePosition: MousePositionWithFeature,
): MenuItem[] {
  const { hoveredFeature, session } = display
  const menuItems: MenuItem[] = []
  if (!hoveredFeature) {
    return menuItems
  }
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  const sourceFeatureMenuItems = boxGlyph.getContextMenuItems(
    display,
    mousePosition,
  )
  menuItems.push({
    label: hoveredFeature.feature.type,
    subMenu: sourceFeatureMenuItems,
  })
  if (isMousePositionWithFeature(mousePosition)) {
    const { bp, feature } = mousePosition
    for (const relative of getRelatedFeatures(feature, bp)) {
      if (relative._id === hoveredFeature.feature._id) {
        continue
      }
      const contextMenuItemsForFeature = boxGlyph.getContextMenuItemsForFeature(
        display,
        relative,
      )
      menuItems.push({
        label: relative.type,
        subMenu: contextMenuItemsForFeature,
      })
    }
  }
  return menuItems
}

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const {
  drawDragPreview,
  drawTooltip,
  getContextMenuItemsForFeature,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
} = boxGlyph
/* eslint-enable @typescript-eslint/unbound-method */

export const genericChildGlyph: Glyph = {
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
