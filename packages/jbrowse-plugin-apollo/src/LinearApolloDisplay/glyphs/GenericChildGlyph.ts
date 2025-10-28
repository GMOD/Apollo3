import { type AnnotationFeature } from '@apollo-annotation/mst'
import { type MenuItem } from '@jbrowse/core/ui'
import { type ContentBlock } from '@jbrowse/core/util/blockTypes'
import { alpha } from '@mui/material'

import {
  type MousePositionWithFeature,
  containsSelectedFeature,
  getContextMenuItemsForFeature,
  isMousePositionWithFeature,
} from '../../util'
import { getRelatedFeatures } from '../../util/annotationFeatureUtils'
import { type LinearApolloDisplay } from '../stateModel'
import { type LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import { type LinearApolloDisplayRendering } from '../stateModel/rendering'

import { boxGlyph, drawBox, getLeftPx } from './BoxGlyph'
import { type Glyph } from './Glyph'

function featuresForRow(feature: AnnotationFeature): AnnotationFeature[][] {
  const features = [[feature]]
  if (feature.children) {
    for (const [, child] of feature.children) {
      features.push(...featuresForRow(child))
    }
  }
  return features
}

function getRowCount(feature: AnnotationFeature) {
  return featuresForRow(feature).length
}

function draw(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { selectedFeature } = display
  for (let i = 0; i < getRowCount(feature); i++) {
    drawRow(display, ctx, feature, row + i, row, block)
  }
  if (selectedFeature && containsSelectedFeature(feature, selectedFeature)) {
    drawHighlight(display, ctx, feature, row, block, true)
  }
}

function drawRow(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  topLevelFeature: AnnotationFeature,
  row: number,
  topRow: number,
  block: ContentBlock,
) {
  const features = featuresForRow(topLevelFeature)[row - topRow]
  for (const feature of features) {
    drawFeature(display, ctx, feature, row, block)
  }
}

function drawFeature(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight: heightPx, lgv, theme } = display
  const rowCount = getRowCount(feature)
  if (rowCount > 1) {
    // draw background that encapsulates all child features
    const { bpPerPx } = lgv
    const leftPx = getLeftPx(display, feature, block)
    const widthPx = feature.length / bpPerPx
    const top = row * heightPx
    const groupingColor = alpha(theme.palette.background.paper, 0.6)
    const featureHeight = rowCount * heightPx
    drawBox(ctx, leftPx, top, widthPx, featureHeight, groupingColor)
  }
  boxGlyph.draw(display, ctx, feature, row, block)
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
    apolloRowHeight * getRowCount(feature),
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
      const contextMenuItemsForFeature = getContextMenuItemsForFeature(
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
  getContextMenuItems,
  getFeatureFromLayout,
  getRowCount,
  getRowForFeature,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
}
