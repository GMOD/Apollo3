import type {
  AnnotationFeature,
  TranscriptPartCoding,
} from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import { getFrame } from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

import { type MousePositionWithFeature, isSelectedFeature } from '../../util'
import type { LinearApolloDisplay } from '../stateModel'
import type { CanvasMouseEvent } from '../types'

import { boxGlyph } from './BoxGlyph'
import type { Glyph } from './Glyph'
import {
  drawHighlight,
  getFeatureBox,
  isMouseOnFeatureEdge,
  strokeRectInner,
} from './util'

function drawCDSLocation(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  cdsLocation: TranscriptPartCoding,
  strand: 1 | -1 | undefined,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight, canvasPatterns, theme } = display
  const [top, left, width] = getFeatureBox(display, cdsLocation, row, block)
  const halfHeight = Math.round(apolloRowHeight / 2)
  if (width > 2) {
    const frame = getFrame(
      cdsLocation.min,
      cdsLocation.max,
      strand ?? 1,
      cdsLocation.phase,
    )
    const frameColor = theme.palette.framesCDS.at(frame)?.main
    ctx.fillStyle = frameColor ?? 'black'
    ctx.fillRect(left, top, width, apolloRowHeight)
    const forwardFill = canvasPatterns.forward
    const backwardFill = canvasPatterns.backward
    if (forwardFill && backwardFill && strand) {
      const { reversed } = block
      const reversal = reversed ? -1 : 1
      const [topFill, bottomFill] =
        strand * reversal === 1
          ? [forwardFill, backwardFill]
          : [backwardFill, forwardFill]
      ctx.fillStyle = topFill
      ctx.fillRect(left, top, width, halfHeight)
      ctx.fillStyle = bottomFill
      ctx.fillRect(left, top + halfHeight, width, halfHeight)
    }
  }
  strokeRectInner(
    ctx,
    left,
    top,
    width,
    apolloRowHeight,
    theme.palette.text.primary,
  )
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  cds: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const transcript = cds.parent
  if (!transcript) {
    boxGlyph.draw(display, ctx, cds, row, block)
    return
  }
  const { cdsLocations } = transcript
  const thisCDSLocations = cdsLocations.find((loc) => {
    const min = loc.at(cds.strand === 1 ? 0 : -1)?.min
    const max = loc.at(cds.strand === 1 ? -1 : 0)?.max
    return cds.min === min && cds.max === max
  })
  if (!thisCDSLocations) {
    return
  }
  for (const cdsLocation of thisCDSLocations) {
    drawCDSLocation(display, ctx, cdsLocation, cds.strand, row, block)
  }
  const { apolloRowHeight, selectedFeature } = display
  if (isSelectedFeature(cds, selectedFeature)) {
    const [top, left, width] = getFeatureBox(display, cds, row, block)
    const height = getRowCount() * apolloRowHeight
    drawHighlight(display, ctx, left, top, width, height, true)
  }
}

function drawHover(
  display: LinearApolloDisplay,
  overlayCtx: CanvasRenderingContext2D,
  cds: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight } = display
  const [top, left, width] = getFeatureBox(display, cds, row, block)
  const height = getRowCount() * apolloRowHeight
  drawHighlight(display, overlayCtx, left, top, width, height)
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

function getContextMenuItemsForFeature(): MenuItem[] {
  return []
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// sourceFeature: AnnotationFeature,

function getContextMenuItems(): MenuItem[] {
  return []
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// currentMousePosition: MousePositionWithFeature,

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
  const transcript = feature.parent
  if (!transcript) {
    return
  }
  const { cdsLocations } = transcript
  const thisCDSLocations = cdsLocations.find((loc) => {
    const min = loc.at(feature.strand === 1 ? 0 : -1)?.min
    const max = loc.at(feature.strand === 1 ? -1 : 0)?.max
    return feature.min === min && feature.max === max
  })
  if (!thisCDSLocations) {
    return
  }
  for (const cdsLocation of thisCDSLocations) {
    const edge = isMouseOnFeatureEdge(mousePosition, cdsLocation, stateModel)
    if (edge) {
      event.stopPropagation()
      stateModel.startDrag(mousePosition, feature, edge)
      return
    }
  }
}

function onMouseMove(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePositionWithFeature,
  event: CanvasMouseEvent,
) {
  const { feature, bp } = mousePosition
  stateModel.setHoveredFeature({ feature, bp })
  const edge = isMouseOnFeatureEdge(mousePosition, feature, stateModel)
  if (edge) {
    stateModel.setCursor('col-resize')
    return
  }
  const transcript = feature.parent
  if (!transcript) {
    boxGlyph.onMouseMove(stateModel, mousePosition, event)
    return
  }
  const { cdsLocations } = transcript
  const thisCDSLocations = cdsLocations.find((loc) => {
    const min = loc.at(feature.strand === 1 ? 0 : -1)?.min
    const max = loc.at(feature.strand === 1 ? -1 : 0)?.max
    return feature.min === min && feature.max === max
  })
  if (!thisCDSLocations) {
    return
  }
  for (const cdsLocation of thisCDSLocations) {
    const edge = isMouseOnFeatureEdge(mousePosition, cdsLocation, stateModel)
    if (edge) {
      stateModel.setCursor('col-resize')
      return
    }
  }
  stateModel.setCursor()
}

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const { drawDragPreview, onMouseLeave, onMouseUp } = boxGlyph
/* eslint-enable @typescript-eslint/unbound-method */

export const cdsGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  getContextMenuItems,
  getContextMenuItemsForFeature,
  getFeatureFromLayout,
  getRowCount,
  getRowForFeature,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
}
