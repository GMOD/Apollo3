import { AnnotationFeature } from '@apollo-annotation/mst'

import { LinearApolloDisplay } from '../stateModel'
import { boxGlyph, isSelectedFeature, drawBox } from './BoxGlyph'
import { Glyph } from './Glyph'
import { LinearApolloDisplayRendering } from '../stateModel/rendering'

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

async function draw(
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  stateModel: LinearApolloDisplayRendering,
  displayedRegionIndex: number,
) {
  for (let i = 0; i < getRowCount(feature); i++) {
    await drawRow(ctx, feature, row + i, row, stateModel, displayedRegionIndex)
  }
}

async function drawRow(
  ctx: CanvasRenderingContext2D,
  topLevelFeature: AnnotationFeature,
  row: number,
  topRow: number,
  stateModel: LinearApolloDisplayRendering,
  displayedRegionIndex: number,
) {
  const features = featuresForRow(topLevelFeature)[row - topRow]
  for (const feature of features) {
    await drawFeature(ctx, feature, row, stateModel, displayedRegionIndex)
  }
}

async function drawFeature(
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
  await boxGlyph.draw(ctx, feature, row, stateModel, displayedRegionIndex)
}

async function drawHover(
  stateModel: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
) {
  const { apolloHover, apolloRowHeight, lgv } = stateModel
  if (!apolloHover) {
    return
  }
  const { feature } = apolloHover
  const position = await stateModel.getFeatureLayoutPosition(feature)
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

// eslint-disable-next-line @typescript-eslint/require-await
async function getFeatureFromLayout(
  feature: AnnotationFeature,
  bp: number,
  row: number,
) {
  const layoutRow = featuresForRow(feature)[row]
  return layoutRow.find((f) => bp >= f.min && bp <= f.max)
}

// eslint-disable-next-line @typescript-eslint/require-await
async function getRowForFeature(
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

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const {
  drawDragPreview,
  drawTooltip,
  getContextMenuItems,
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
