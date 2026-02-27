import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

import { MergeTranscripts } from '../../components'
import {
  isCDSFeature,
  isExonFeature,
  isSelectedFeature,
} from '../../util/glyphUtils'
import type { LinearApolloDisplay } from '../stateModel'

import { boxGlyph } from './BoxGlyph'
import type { Glyph, LayoutRow } from './Glyph'
import { drawHighlight, getFeatureBox, getLeftPx } from './util'

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

function getRowCount(display: LinearApolloDisplay, feature: AnnotationFeature) {
  return getLayout(display, feature).byRow.length
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  transcript: AnnotationFeature,
  row: number,
  rowInFeature: number,
  block: ContentBlock,
) {
  drawTranscriptLine(display, ctx, transcript, row, block)
  const { apolloRowHeight, selectedFeature } = display
  if (isSelectedFeature(transcript, selectedFeature)) {
    const [top, left, width] = getFeatureBox(display, transcript, row, block)
    const height = apolloRowHeight * getRowCount(display, transcript)
    drawHighlight(display, ctx, left, top, width, height, true)
  }
}

function drawHover(
  display: LinearApolloDisplay,
  overlayCtx: CanvasRenderingContext2D,
  transcript: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight } = display
  const [top, left, width] = getFeatureBox(display, transcript, row, block)
  const height = apolloRowHeight * getRowCount(display, transcript)
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
  layout.byRow = []
  const exons = getExonChildren(display, feature)
  const nonExonChildren = getNonExonChildren(display, feature)
  layout.byFeature.set(feature._id, 0)
  // Usually non-coding (no CDS) transcript
  if (nonExonChildren.length === 0) {
    const row: LayoutRow = []
    row.push({ feature, rowInFeature: 0 })
    for (const exon of exons) {
      row.push({ feature: exon, rowInFeature: 0 })
      layout.byFeature.set(exon._id, 0)
    }
    layout.byRow.push(row)
    return layout
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { getGlyph, session } = display
  let extraOffset = 0
  for (const [idx, child] of nonExonChildren.entries()) {
    const row: LayoutRow = []
    row.push({ feature, rowInFeature: idx + extraOffset })
    if (isCDSFeature(child, session)) {
      for (const exon of exons) {
        row.push({ feature: exon, rowInFeature: extraOffset })
        layout.byFeature.set(exon._id, extraOffset)
      }
      row.push({ feature: child, rowInFeature: extraOffset })
      layout.byFeature.set(child._id, extraOffset)
    } else {
      const glyph = getGlyph(child)
      const rowCount = glyph.getLayout(display, child).byRow.length
      for (let i = 0; i < rowCount; i++) {
        row.push({ feature: child, rowInFeature: i })
        layout.byFeature.set(child._id, i)
      }
      extraOffset += rowCount - 1
    }
    layout.byRow.push(row)
  }
  return layout
}

function getContextMenuItems(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
): MenuItem[] {
  const { changeManager, regions, selectedFeature, session } = display
  const [region] = regions
  const currentAssemblyId = display.getAssemblyId(region.assemblyName)
  const menuItems: MenuItem[] = []
  if (isSessionModelWithWidgets(session)) {
    menuItems.splice(1, 0, {
      label: 'Open transcript editor',
      onClick: () => {
        const apolloTranscriptWidget = session.addWidget(
          'ApolloTranscriptDetails',
          'apolloTranscriptDetails',
          {
            feature,
            assembly: currentAssemblyId,
            changeManager,
            refName: region.refName,
          },
        )
        session.showWidget(apolloTranscriptWidget)
      },
    })
  }
  menuItems.push({
    label: 'Merge transcript',
    onClick: () => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          MergeTranscripts,
          {
            session,
            handleClose: () => {
              doneCallback()
            },
            changeManager,
            sourceFeature: feature,
            sourceAssemblyId: currentAssemblyId,
            selectedFeature,
            setSelectedFeature: (feature?: AnnotationFeature) => {
              display.setSelectedFeature(feature)
            },
          },
        ],
      )
    },
  })
  return menuItems
}

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const { drawDragPreview } = boxGlyph
/* eslint-enable @typescript-eslint/unbound-method */

export const transcriptGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  getContextMenuItems,
  getLayout,
  isDraggable: false,
}
