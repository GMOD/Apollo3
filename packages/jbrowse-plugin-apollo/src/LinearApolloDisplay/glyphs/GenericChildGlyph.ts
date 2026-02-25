import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { alpha } from '@mui/material'

import {
  type MousePositionWithFeature,
  isMousePositionWithFeature,
  isSelectedFeature,
} from '../../util'
import { getRelatedFeatures } from '../../util/annotationFeatureUtils'
import type { LinearApolloDisplay } from '../stateModel'
import type { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'

import { boxGlyph } from './BoxGlyph'
import type { Glyph } from './Glyph'
import { drawHighlight, getFeatureBox, strokeRectInner } from './util'

interface LayoutRow {
  feature: AnnotationFeature
  glyph: Glyph
  rowInFeature: number
}

function getLayoutRows(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
): LayoutRow[] {
  const rows: LayoutRow[] = [
    { feature, glyph: genericChildGlyph, rowInFeature: 0 },
  ]
  const { children } = feature
  if (!children) {
    return rows
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { getGlyph } = display
  for (const [, child] of children) {
    const glyph = getGlyph(child)
    const newRowCount = glyph.getRowCount(display, child)
    for (let i = 0; i < newRowCount; i++) {
      rows.push({ feature: child, glyph, rowInFeature: i })
    }
  }
  return rows
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight, selectedFeature, theme } = display
  const [top, left, width] = getFeatureBox(display, feature, row, block)
  const height = getRowCount(display, feature) * apolloRowHeight
  if (width > 2) {
    ctx.fillStyle = alpha(theme.palette.background.paper, 0.6)
    ctx.fillRect(left, top, width, height)
  }
  strokeRectInner(ctx, left, top, width, height, theme.palette.text.primary)
  boxGlyph.draw(display, ctx, feature, row, block)
  const { children } = feature
  if (!children) {
    return
  }
  const childRows = getLayoutRows(display, feature).slice(1)
  let rowOffset = 1
  for (const childRow of childRows) {
    const { feature: childFeature, glyph, rowInFeature } = childRow
    if (rowInFeature > 0) {
      rowOffset += 1
      continue
    }
    glyph.draw(display, ctx, childFeature, row + rowOffset, block)
    rowOffset += 1
  }

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
  const { apolloRowHeight } = display
  const [top, left, width] = getFeatureBox(display, feature, row, block)
  const height = getRowCount(display, feature) * apolloRowHeight
  drawHighlight(display, overlayCtx, left, top, width, height)
}

function getRowCount(display: LinearApolloDisplay, feature: AnnotationFeature) {
  const rows = getLayoutRows(display, feature)
  return rows.length
}

function getFeaturesFromLayout(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
  bp: number,
  row: number,
) {
  const layoutRows = getLayoutRows(display, feature)
  const layoutRow = layoutRows.at(row)
  if (!layoutRow) {
    return []
  }
  const { feature: rowFeature, glyph, rowInFeature } = layoutRow
  if (rowInFeature === 0) {
    if (bp >= rowFeature.min && bp <= rowFeature.max) {
      return [rowFeature]
    }
    return []
  }
  return glyph.getFeaturesFromLayout(display, rowFeature, bp, rowInFeature)
}

function getRowForFeature(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
  childFeature: AnnotationFeature,
) {
  const rows = getLayoutRows(display, feature)
  for (const [idx, row] of rows.entries()) {
    const { feature: rowFeature } = row
    if (rowFeature._id === childFeature._id) {
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
  getContextMenuItemsForFeature,
  getContextMenuItems,
  getFeaturesFromLayout,
  getRowCount,
  getRowForFeature,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
}
