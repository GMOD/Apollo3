import type { AnnotationFeature } from '@apollo-annotation/mst'
import { readConfObject } from '@jbrowse/core/configuration'
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
  gene: AnnotationFeature,
  row: number,
  rowInFeature: number,
  block: ContentBlock,
): void {
  if (rowInFeature > 0) {
    return
  }
  const { apolloRowHeight, theme, selectedFeature, session } = display
  const [top, left, width] = getFeatureBox(display, gene, row, block)
  const height = getRowCount(display, gene) * apolloRowHeight
  if (width > 2) {
    let selectedColor = readConfObject(
      session.getPluginConfiguration(),
      'geneBackgroundColor',
      { featureType: gene.type },
    ) as string
    selectedColor = alpha(theme.palette.background.paper, 0.6)
    ctx.fillStyle = selectedColor
    ctx.fillRect(left, top, width, height)
  }
  strokeRectInner(ctx, left, top, width, height, theme.palette.text.primary)

  if (isSelectedFeature(gene, selectedFeature)) {
    drawHighlight(display, ctx, left, top, width, height, true)
  }
}

function drawHover(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  gene: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight } = display
  const [top, left, width] = getFeatureBox(display, gene, row, block)
  const height = getRowCount(display, gene) * apolloRowHeight
  drawHighlight(display, ctx, left, top, width, height)
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
  layout.byRow = []
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

export const geneGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  getContextMenuItems,
  getLayout,
  isDraggable: false,
}
