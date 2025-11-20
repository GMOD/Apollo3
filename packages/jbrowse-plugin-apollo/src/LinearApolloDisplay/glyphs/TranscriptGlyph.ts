import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

import { type MousePositionWithFeature } from '../../util'
import { isCDSFeature, isExonFeature } from '../../util/glyphUtils'
import type { LinearApolloDisplay } from '../stateModel'


import { cdsGlyph } from './CDSGlyph'
import { exonGlyph } from './ExonGlyph'
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

function getExonChildren(
  display: LinearApolloDisplay,
  transcript: AnnotationFeature,
): AnnotationFeature[] {
  const { children } = transcript
  if (!children) {
    return []
  }
  const { session } = display
  return [...children.values()].filter((child) => isExonFeature(child, session))
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

interface LayoutRowFeature {
  feature: AnnotationFeature
  glyph: Glyph
  rowInFeature: number
}

type LayoutRow = LayoutRowFeature[]

function getLayoutRows(
  display: LinearApolloDisplay,
  transcript: AnnotationFeature,
): LayoutRow[] {
  const { children } = transcript
  if (!children) {
    return []
  }
  const rows: LayoutRow[] = []
  const exons = getExonChildren(display, transcript)
  const nonExonChildren = getNonExonChildren(display, transcript)
  // Usually non-coding (no CDS) transcript
  if (nonExonChildren.length === 0) {
    const row: LayoutRow = []
    for (const exon of exons) {
      row.push({ feature: exon, glyph: exonGlyph, rowInFeature: 0 })
    }
    rows.push(row)
    return rows
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { getGlyph, session } = display
  let extraOffset = 0
  for (const [idx, child] of nonExonChildren.entries()) {
    const row: LayoutRow = []
    if (isCDSFeature(child, session)) {
      for (const exon of exons) {
        row.push({
          feature: exon,
          glyph: exonGlyph,
          rowInFeature: idx + extraOffset,
        })
      }
      row.push({
        feature: child,
        glyph: cdsGlyph,
        rowInFeature: idx + extraOffset,
      })
    } else {
      const glyph = getGlyph(child)
      const rowCount = glyph.getRowCount(display, child)
      for (let i = 0; i < rowCount; i++) {
        row.push({ feature: child, glyph, rowInFeature: i })
      }
      extraOffset += rowCount - 1
    }
    rows.push(row)
  }
  return rows
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  transcript: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const rows = getLayoutRows(display, transcript)
  if (rows.length === 0) {
    drawTranscriptLine(display, ctx, transcript, row, block)
    return
  }
  for (const [idx, layoutRow] of rows.entries()) {
    drawTranscriptLine(display, ctx, transcript, row + idx, block)
    for (const layoutFeature of layoutRow) {
      const { feature, glyph, rowInFeature } = layoutFeature
      if (rowInFeature > 1) {
        continue
      }
      glyph.draw(display, ctx, feature, row + rowInFeature, block)
    }
  }
}

function getRowCount(display: LinearApolloDisplay, feature: AnnotationFeature) {
  const rows = getLayoutRows(display, feature)
  if (rows.length === 0) {
    return 1
  }
  return rows.length
}

function getFeatureFromLayout(
  display: LinearApolloDisplay,
  transcript: AnnotationFeature,
  bp: number,
  row: number,
) {
  const layoutRow = getLayoutRows(display, transcript).at(row)
  if (!layoutRow) {
    return
  }
  // If it's in an intron, return the transcript
  // Then if it's in an exon and the CDS, return the CDS
  // Then if it's in an exon, return the exon
  const isInTranscript = bp >= transcript.min && bp <= transcript.max
  if (!isInTranscript) {
    return
  }
  const { session } = display
  const matchingExonLayout = layoutRow.find((layoutRowFeature) => {
    const { feature } = layoutRowFeature
    const isExon = isExonFeature(feature, session)
    if (!isExon) {
      return false
    }
    return bp >= feature.min && bp <= feature.max
  })
  if (!matchingExonLayout) {
    return transcript
  }
  const matchingCDSLayout = layoutRow.find((layoutRowFeature) => {
    const { feature } = layoutRowFeature
    const isCDS = isCDSFeature(feature, session)
    if (!isCDS) {
      return false
    }
    return bp >= feature.min && bp <= feature.max
  })
  if (matchingCDSLayout) {
    return matchingCDSLayout.feature
  }
  return matchingExonLayout.feature
}

function getRowForFeature(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
  childFeature: AnnotationFeature,
) {
  const rows = getLayoutRows(display, feature)
  for (const [idx, row] of rows.entries()) {
    for (const rowFeature of row) {
      if (rowFeature.feature._id === childFeature._id) {
        return idx
      }
    }
  }
  return
}

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

function onMouseMove(
  display: LinearApolloDisplay,
  mousePosition: MousePositionWithFeature,
) {
  const { feature, bp } = mousePosition
  display.setHoveredFeature({ feature, bp })
}

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
