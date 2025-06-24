import { type AnnotationFeature } from '@apollo-annotation/mst'
import { type MenuItem } from '@jbrowse/core/ui'

import {
  getFeaturesUnderClick,
  makeFeatureLabel,
} from '../../util/annotationFeatureUtils'
import { type LinearApolloDisplay } from '../stateModel'
import {
  type LinearApolloDisplayMouseEvents,
  type MousePositionWithFeatureAndGlyph,
} from '../stateModel/mouseEvents'
import { type LinearApolloDisplayRendering } from '../stateModel/rendering'

import { boxGlyph, drawBox, isSelectedFeature } from './BoxGlyph'
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
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  stateModel: LinearApolloDisplayRendering,
  displayedRegionIndex: number,
) {
  for (let i = 0; i < getRowCount(feature); i++) {
    drawRow(ctx, feature, row + i, row, stateModel, displayedRegionIndex)
  }
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  topLevelFeature: AnnotationFeature,
  row: number,
  topRow: number,
  stateModel: LinearApolloDisplayRendering,
  displayedRegionIndex: number,
) {
  const features = featuresForRow(topLevelFeature)[row - topRow]
  for (const feature of features) {
    drawFeature(ctx, feature, row, stateModel, displayedRegionIndex)
  }
}

function drawFeature(
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  stateModel: LinearApolloDisplayRendering,
  displayedRegionIndex: number,
) {
  const { apolloRowHeight: heightPx, lgv, session } = stateModel
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[displayedRegionIndex]
  const minX =
    (lgv.bpToPx({
      refName: displayedRegion.refName,
      coord: feature.min,
      regionNumber: displayedRegionIndex,
    })?.offsetPx ?? 0) - offsetPx
  const { reversed } = displayedRegion
  const { apolloSelectedFeature } = session
  const widthPx = feature.length / bpPerPx
  const startPx = reversed ? minX - widthPx : minX
  const top = row * heightPx
  const rowCount = getRowCount(feature)
  const isSelected = isSelectedFeature(feature, apolloSelectedFeature)
  const groupingColor = isSelected ? 'rgba(130,0,0,0.45)' : 'rgba(255,0,0,0.25)'
  if (rowCount > 1) {
    // draw background that encapsulates all child features
    const featureHeight = rowCount * heightPx
    drawBox(ctx, startPx, top, widthPx, featureHeight, groupingColor)
  }
  boxGlyph.draw(ctx, feature, row, stateModel, displayedRegionIndex)
}

function drawHover(
  stateModel: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
) {
  const { apolloHover, apolloRowHeight, lgv } = stateModel
  if (!apolloHover) {
    return
  }
  const { feature } = apolloHover
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
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fillRect(startPx, top, widthPx, apolloRowHeight * getRowCount(feature))
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
  mousePosition: MousePositionWithFeatureAndGlyph,
): MenuItem[] {
  const { apolloHover, session } = display
  const menuItems: MenuItem[] = []
  if (!apolloHover) {
    return menuItems
  }
  const { feature: sourceFeature } = apolloHover
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  const sourceFeatureMenuItems = boxGlyph.getContextMenuItems(
    display,
    mousePosition,
  )
  menuItems.push({
    label: makeFeatureLabel(sourceFeature),
    subMenu: sourceFeatureMenuItems,
  })
  for (const relative of getFeaturesUnderClick(mousePosition)) {
    if (relative._id === sourceFeature._id) {
      continue
    }
    const contextMenuItemsForFeature = boxGlyph.getContextMenuItemsForFeature(
      display,
      relative,
    )
    menuItems.push({
      label: makeFeatureLabel(relative),
      subMenu: contextMenuItemsForFeature,
    })
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
