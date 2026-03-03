import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { alpha } from '@mui/material'

import { isSelectedFeature } from '../../util'
import type { LinearApolloDisplay } from '../stateModel'

import { boxGlyph } from './BoxGlyph'
import type { Glyph } from './Glyph'
import { drawHighlight, getFeatureBox, strokeRectInner } from './util'

function getRowCount(display: LinearApolloDisplay, feature: AnnotationFeature) {
  return getLayout(display, feature).byRow.length
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  rowInFeature: number,
  block: ContentBlock,
) {
  if (rowInFeature > 0) {
    return
  }
  const { apolloRowHeight, selectedFeature, theme } = display
  const [top, left, width] = getFeatureBox(display, feature, row, block)
  const height = getRowCount(display, feature) * apolloRowHeight
  if (width > 2) {
    ctx.fillStyle = alpha(theme.palette.background.paper, 0.6)
    ctx.fillRect(left, top, width, height)
  }
  strokeRectInner(ctx, left, top, width, height, theme.palette.text.primary)
  boxGlyph.draw(display, ctx, feature, row, 0, block)

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

function getLayout(display: LinearApolloDisplay, feature: AnnotationFeature) {
  const layout = {
    byFeature: new Map([[feature._id, 0]]),
    byRow: [[{ feature, rowInFeature: 0 }]],
    min: feature.min,
    max: feature.max,
  }
  const { children } = feature
  if (!children) {
    return layout
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { getGlyph } = display
  for (const [, child] of children) {
    const glyph = getGlyph(child)
    const childLayout = glyph.getLayout(display, child)
    const startingRowIndex = layout.byRow.length
    for (const [idx, row] of childLayout.byRow.entries()) {
      layout.byRow.push([
        { feature, rowInFeature: startingRowIndex + idx },
        ...row,
      ])
    }
    for (const entry of childLayout.byFeature.entries()) {
      const [featureId, rowNumber] = entry
      layout.byFeature.set(featureId, rowNumber + startingRowIndex)
    }
  }
  return layout
}

function getContextMenuItems(): MenuItem[] {
  return []
}

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const { drawDragPreview } = boxGlyph
/* eslint-enable @typescript-eslint/unbound-method */

export const genericChildGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  getContextMenuItems,
  getLayout,
  isDraggable: true,
}
