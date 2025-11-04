import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

import { isExonFeature } from '../../util/glyphUtils'
import type { LinearApolloDisplay } from '../stateModel'

import type { Glyph } from './Glyph'
import { getLeftPx } from './util'

function* range(start: number, stop: number, step = 1): Generator<number> {
  if (start === stop) {
    return
  }
  if (start < stop) {
    for (let i = start; i < stop; i += step) {
      yield i
    }
    return
  }
  for (let i = start; i > stop; i -= step) {
    yield i
  }
}

function drawTranscriptLine(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  transcript: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight, lgv, theme } = display
  const { bpPerPx } = lgv
  const { reversed } = block
  const left = Math.round(getLeftPx(display, transcript, block))
  const width = Math.round(transcript.length / bpPerPx)
  const top = Math.round(apolloRowHeight / 2) + row * apolloRowHeight
  ctx.strokeStyle = theme.palette.text.primary
  const { strand = 1 } = transcript
  ctx.beginPath()
  // If view is reversed, draw forward as reverse and vice versa
  const effectiveStrand = strand * (reversed ? -1 : 1)
  // Draw the transcript line, and extend it out a bit on the 3` end
  const lineStart = left - (effectiveStrand === -1 ? 5 : 0)
  const lineEnd = left + width + (effectiveStrand === -1 ? 0 : 5)
  ctx.moveTo(lineStart, top)
  ctx.lineTo(lineEnd, top)
  // Now to draw arrows every 20 pixels along the line
  // Make the arrow range a bit shorter to avoid an arrow hanging off the 5` end
  const arrowsStart = lineStart + (effectiveStrand === -1 ? 0 : 3)
  const arrowsEnd = lineEnd - (effectiveStrand === -1 ? 3 : 0)
  // Offset determines if the arrows face left or right
  const offset = effectiveStrand === -1 ? 3 : -3
  const arrowRange =
    effectiveStrand === -1
      ? range(arrowsStart, arrowsEnd, 20)
      : range(arrowsEnd, arrowsStart, 20)
  for (const arrowLocation of arrowRange) {
    ctx.moveTo(arrowLocation + offset, top + offset)
    ctx.lineTo(arrowLocation, top)
    ctx.lineTo(arrowLocation + offset, top - offset)
  }
  ctx.stroke()
}

function getNonExonChildren(
  display: LinearApolloDisplay,
  transcript: AnnotationFeature,
): AnnotationFeature[] {
  const { children } = transcript
  if (!children) {
    return []
  }
  const { session } = display
  return [...children.values()].filter(
    (child) => !isExonFeature(child, session),
  )
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  transcript: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const nonExonChildren = getNonExonChildren(display, transcript)
  for (const [idx] of nonExonChildren.entries()) {
    drawTranscriptLine(display, ctx, transcript, row + idx, block)
  }
}

function getRowCount(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
): number {
  const nonExonChildren = getNonExonChildren(display, feature)
  if (nonExonChildren.length === 0) {
    return 1
  }
  return nonExonChildren.length
}

function getFeatureFromLayout(): AnnotationFeature | undefined {
  return undefined
  // Not implemented
}
// feature: AnnotationFeature,
// bp: number,
// row: number,
// featureTypeOntology: OntologyRecord,
function getRowForFeature(): number | undefined {
  // Not implemented
  return undefined
}
// feature: AnnotationFeature,
// childFeature: AnnotationFeature,
// featureTypeOntology: OntologyRecord,

function drawHover() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// overlayCtx: CanvasRenderingContext2D,

function drawDragPreview() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// ctx: CanvasRenderingContext2D,

function onMouseDown() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// currentMousePosition: MousePositionWithFeature,
// event: CanvasMouseEvent,

function onMouseMove() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// currentMousePosition: MousePositionWithFeature,
// event: CanvasMouseEvent,

function onMouseLeave() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// currentMousePosition: MousePositionWithFeature,
// event: CanvasMouseEvent,

function onMouseUp() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// currentMousePosition: MousePositionWithFeature,
// event: CanvasMouseEvent,

function drawTooltip() {
  // Not implemented
}
// display: LinearApolloDisplayMouseEvents,
// context: CanvasRenderingContext2D,

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

export const transcriptGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  drawTooltip,
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
