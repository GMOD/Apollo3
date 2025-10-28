import { type AnnotationFeature } from '@apollo-annotation/mst'
import { readConfObject } from '@jbrowse/core/configuration'
import { type BaseDisplayModel } from '@jbrowse/core/pluggableElementTypes'
import { type MenuItem } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  getContainingView,
  getFrame,
  intersection2,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { type ContentBlock } from '@jbrowse/core/util/blockTypes'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { alpha } from '@mui/material'

import { type OntologyRecord } from '../../OntologyManager'
import { MergeExons, MergeTranscripts, SplitExon } from '../../components'
import {
  type MousePosition,
  type MousePositionWithFeature,
  containsSelectedFeature,
  getAdjacentExons,
  getContextMenuItemsForFeature,
  getMinAndMaxPx,
  getOverlappingEdge,
  getStreamIcon,
  isCDSFeature,
  isExonFeature,
  isMousePositionWithFeature,
  isTranscriptFeature,
  navToFeatureCenter,
  selectFeatureAndOpenWidget,
} from '../../util'
import { getRelatedFeatures } from '../../util/annotationFeatureUtils'
import { type LinearApolloDisplay } from '../stateModel'
import { type LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import { type LinearApolloDisplayRendering } from '../stateModel/rendering'
import { type CanvasMouseEvent } from '../types'

import { boxGlyph, getLeftPx } from './BoxGlyph'
import { type Glyph } from './Glyph'

let forwardFillLight: CanvasPattern | null = null
let backwardFillLight: CanvasPattern | null = null
let forwardFillDark: CanvasPattern | null = null
let backwardFillDark: CanvasPattern | null = null
const canvas = globalThis.document.createElement('canvas')
// @ts-expect-error getContext is undefined in the web worker
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (canvas?.getContext) {
  for (const direction of ['forward', 'backward']) {
    for (const themeMode of ['light', 'dark']) {
      const canvas = document.createElement('canvas')
      const canvasSize = 10
      canvas.width = canvas.height = canvasSize
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const stripeColor1 =
          themeMode === 'light' ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.75)'
        const stripeColor2 =
          themeMode === 'light' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.50)'
        const gradient =
          direction === 'forward'
            ? ctx.createLinearGradient(0, canvasSize, canvasSize, 0)
            : ctx.createLinearGradient(0, 0, canvasSize, canvasSize)
        gradient.addColorStop(0, stripeColor1)
        gradient.addColorStop(0.25, stripeColor1)
        gradient.addColorStop(0.25, stripeColor2)
        gradient.addColorStop(0.5, stripeColor2)
        gradient.addColorStop(0.5, stripeColor1)
        gradient.addColorStop(0.75, stripeColor1)
        gradient.addColorStop(0.75, stripeColor2)
        gradient.addColorStop(1, stripeColor2)
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 10, 10)
        if (direction === 'forward') {
          if (themeMode === 'light') {
            forwardFillLight = ctx.createPattern(canvas, 'repeat')
          } else {
            forwardFillDark = ctx.createPattern(canvas, 'repeat')
          }
        } else {
          if (themeMode === 'light') {
            backwardFillLight = ctx.createPattern(canvas, 'repeat')
          } else {
            backwardFillDark = ctx.createPattern(canvas, 'repeat')
          }
        }
      }
    }
  }
}

function drawBackground(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
  color?: string,
) {
  const { apolloRowHeight, lgv, session, theme } = display
  const { bpPerPx } = lgv
  const { apolloDataStore } = session
  const { featureTypeOntology } = apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }

  const topLevelFeatureStartPx = getLeftPx(display, feature, block)
  const topLevelFeatureWidthPx = feature.length / bpPerPx
  const topLevelFeatureTop = row * apolloRowHeight
  const topLevelFeatureHeight =
    getRowCount(feature, featureTypeOntology) * apolloRowHeight

  let selectedColor
  if (color) {
    selectedColor = color
  } else {
    selectedColor = readConfObject(
      session.getPluginConfiguration(),
      'geneBackgroundColor',
      { featureType: feature.type },
    ) as string
    if (!selectedColor) {
      selectedColor = alpha(theme.palette.background.paper, 0.6)
    }
  }
  ctx.fillStyle = selectedColor
  ctx.fillRect(
    topLevelFeatureStartPx,
    topLevelFeatureTop,
    topLevelFeatureWidthPx,
    topLevelFeatureHeight,
  )
}

function draw(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
): void {
  const { apolloRowHeight, lgv, selectedFeature, session, theme } = display
  const { bpPerPx } = lgv
  const { reversed } = block
  const rowHeight = apolloRowHeight
  const cdsHeight = Math.round(0.9 * rowHeight)
  const { children, strand } = feature
  if (!children) {
    return
  }
  const { apolloDataStore } = session
  const { featureTypeOntology } = apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }

  // Draw background for gene
  drawBackground(display, ctx, feature, row, block)

  // Draw lines on different rows for each transcript
  let currentRow = 0
  for (const [, transcript] of children) {
    const isTranscript =
      featureTypeOntology.isTypeOf(transcript.type, 'transcript') ||
      featureTypeOntology.isTypeOf(transcript.type, 'pseudogenic_transcript')
    if (!isTranscript) {
      currentRow += 1
      continue
    }
    const { children: transcriptChildren } = transcript
    if (!transcriptChildren) {
      continue
    }
    const cdsCount = getCDSCount(transcript, featureTypeOntology)

    for (const [, childFeature] of transcriptChildren) {
      if (!featureTypeOntology.isTypeOf(childFeature.type, 'CDS')) {
        continue
      }
      drawLine(display, ctx, transcript, row, currentRow, block)
      currentRow += 1
    }

    if (cdsCount === 0) {
      drawLine(display, ctx, transcript, row, currentRow, block)
      currentRow += 1
    }
  }

  const forwardFill =
    theme.palette.mode === 'dark' ? forwardFillDark : forwardFillLight
  const backwardFill =
    theme.palette.mode === 'dark' ? backwardFillDark : backwardFillLight
  // Draw exon and CDS for each transcript
  currentRow = 0
  for (const [, child] of children) {
    if (
      !(
        featureTypeOntology.isTypeOf(child.type, 'transcript') ||
        featureTypeOntology.isTypeOf(child.type, 'pseudogenic_transcript')
      )
    ) {
      boxGlyph.draw(display, ctx, child, row, block)
      currentRow += 1
      continue
    }
    const cdsCount = getCDSCount(child, featureTypeOntology)
    if (cdsCount != 0) {
      for (const cdsRow of child.cdsLocations) {
        const { children: transcriptChildren } = child
        if (!transcriptChildren) {
          continue
        }
        for (const [, exon] of transcriptChildren) {
          if (!featureTypeOntology.isTypeOf(exon.type, 'exon')) {
            continue
          }
          drawExon(
            display,
            ctx,
            exon,
            row,
            currentRow,
            block,
            strand,
            forwardFill,
            backwardFill,
          )
        }
        for (const cds of cdsRow) {
          const cdsWidthPx = (cds.max - cds.min) / bpPerPx
          const cdsStartPx = getLeftPx(display, cds, block)
          ctx.fillStyle = theme.palette.text.primary
          const cdsTop =
            (row + currentRow) * rowHeight + (rowHeight - cdsHeight) / 2
          ctx.fillRect(cdsStartPx, cdsTop, cdsWidthPx, cdsHeight)
          if (cdsWidthPx > 2) {
            ctx.clearRect(
              cdsStartPx + 1,
              cdsTop + 1,
              cdsWidthPx - 2,
              cdsHeight - 2,
            )
            const frame = getFrame(
              cds.min,
              cds.max,
              child.strand ?? 1,
              cds.phase,
            )
            const frameColor = theme.palette.framesCDS.at(frame)?.main
            ctx.fillStyle = frameColor ?? 'black'
            ctx.fillRect(
              cdsStartPx + 1,
              cdsTop + 1,
              cdsWidthPx - 2,
              cdsHeight - 2,
            )
            if (forwardFill && backwardFill && strand) {
              const reversal = reversed ? -1 : 1
              const [topFill, bottomFill] =
                strand * reversal === 1
                  ? [forwardFill, backwardFill]
                  : [backwardFill, forwardFill]
              ctx.fillStyle = topFill
              ctx.fillRect(
                cdsStartPx + 1,
                cdsTop + 1,
                cdsWidthPx - 2,
                (cdsHeight - 2) / 2,
              )
              ctx.fillStyle = bottomFill
              ctx.fillRect(
                cdsStartPx + 1,
                cdsTop + (cdsHeight - 2) / 2,
                cdsWidthPx - 2,
                (cdsHeight - 2) / 2,
              )
            }
          }
        }
        currentRow += 1
      }
    }

    const { children: transcriptChildren } = child
    // Draw exons for non-coding genes
    if (cdsCount === 0 && transcriptChildren) {
      for (const [, exon] of transcriptChildren) {
        if (!featureTypeOntology.isTypeOf(exon.type, 'exon')) {
          continue
        }
        drawExon(
          display,
          ctx,
          exon,
          row,
          currentRow,
          block,
          strand,
          forwardFill,
          backwardFill,
        )
      }
      currentRow += 1
    }
  }
  if (selectedFeature && containsSelectedFeature(feature, selectedFeature)) {
    drawHighlight(display, ctx, selectedFeature, row, block, true)
  }
}

function drawExon(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  exon: AnnotationFeature,
  row: number,
  currentRow: number,
  block: ContentBlock,
  strand: number | undefined,
  forwardFill: CanvasPattern | null,
  backwardFill: CanvasPattern | null,
) {
  const { apolloRowHeight, lgv, theme } = display
  const { bpPerPx } = lgv
  const { reversed } = block

  const startPx = getLeftPx(display, exon, block)
  const widthPx = exon.length / bpPerPx

  const top = (row + currentRow) * apolloRowHeight
  const exonHeight = Math.round(0.6 * apolloRowHeight)
  const exonTop = top + (apolloRowHeight - exonHeight) / 2
  ctx.fillStyle = theme.palette.text.primary
  ctx.fillRect(startPx, exonTop, widthPx, exonHeight)
  if (widthPx > 2) {
    ctx.clearRect(startPx + 1, exonTop + 1, widthPx - 2, exonHeight - 2)
    ctx.fillStyle = 'rgb(211,211,211)'
    ctx.fillRect(startPx + 1, exonTop + 1, widthPx - 2, exonHeight - 2)
    if (forwardFill && backwardFill && strand) {
      const reversal = reversed ? -1 : 1
      const [topFill, bottomFill] =
        strand * reversal === 1
          ? [forwardFill, backwardFill]
          : [backwardFill, forwardFill]
      ctx.fillStyle = topFill
      ctx.fillRect(startPx + 1, exonTop + 1, widthPx - 2, (exonHeight - 2) / 2)
      ctx.fillStyle = bottomFill
      ctx.fillRect(
        startPx + 1,
        exonTop + 1 + (exonHeight - 2) / 2,
        widthPx - 2,
        (exonHeight - 2) / 2,
      )
    }
  }
}

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

function drawLine(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  transcript: AnnotationFeature,
  row: number,
  currentRow: number,
  block: ContentBlock,
) {
  const { apolloRowHeight, lgv, theme } = display
  const { bpPerPx } = lgv
  const { reversed } = block
  const startPx = getLeftPx(display, transcript, block)
  const widthPx = Math.round(transcript.length / bpPerPx)
  const height =
    Math.round((currentRow + 1 / 2) * apolloRowHeight) + row * apolloRowHeight
  ctx.strokeStyle = theme.palette.text.primary
  const { strand = 1 } = transcript
  ctx.beginPath()
  // If view is reversed, draw forward as reverse and vice versa
  const effectiveStrand = strand * (reversed ? -1 : 1)
  // Draw the transcript line, and extend it out a bit on the 3` end
  const lineStart = startPx - (effectiveStrand === -1 ? 5 : 0)
  const lineEnd = startPx + widthPx + (effectiveStrand === -1 ? 0 : 5)
  ctx.moveTo(lineStart, height)
  ctx.lineTo(lineEnd, height)
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
    ctx.moveTo(arrowLocation + offset, height + offset)
    ctx.lineTo(arrowLocation, height)
    ctx.lineTo(arrowLocation + offset, height - offset)
  }
  ctx.stroke()
}

function drawDragPreview(
  display: LinearApolloDisplay,
  overlayCtx: CanvasRenderingContext2D,
) {
  const { apolloDragging, apolloRowHeight, lgv, theme } = display
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  if (!apolloDragging) {
    return
  }
  const { current, edge, feature, start } = apolloDragging

  const row = Math.floor(start.y / apolloRowHeight)
  const region = displayedRegions[start.regionNumber]
  const rowCount = 1
  const featureEdgeBp = region.reversed
    ? region.end - feature[edge]
    : feature[edge] - region.start
  const featureEdgePx = featureEdgeBp / bpPerPx - offsetPx
  const rectX = Math.min(current.x, featureEdgePx)
  const rectY = row * apolloRowHeight
  const rectWidth = Math.abs(current.x - featureEdgePx)
  const rectHeight = apolloRowHeight * rowCount
  overlayCtx.strokeStyle = theme.palette.info.main
  overlayCtx.setLineDash([6])
  overlayCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
  overlayCtx.fillStyle = alpha(theme.palette.info.main, 0.2)
  overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight)
}

function drawHighlight(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
  selected = false,
) {
  const { apolloRowHeight, lgv, session, theme } = display
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager

  const { bpPerPx } = lgv
  const { length } = feature
  const startPx = getLeftPx(display, feature, block)
  const top = row * apolloRowHeight
  const widthPx = length / bpPerPx
  ctx.fillStyle = selected
    ? theme.palette.action.disabled
    : theme.palette.action.focus

  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  ctx.fillRect(
    startPx,
    top,
    widthPx,
    apolloRowHeight * getRowCount(feature, featureTypeOntology),
  )
}

function drawHover(
  display: LinearApolloDisplayRendering,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  drawHighlight(display, ctx, feature, row, block)
}

function getFeatureFromLayout(
  feature: AnnotationFeature,
  bp: number,
  row: number,
  featureTypeOntology: OntologyRecord,
): AnnotationFeature | undefined {
  const featureInThisRow: AnnotationFeature[] =
    featuresForRow(feature, featureTypeOntology)[row] || []
  for (const f of featureInThisRow) {
    let featureObj
    if (bp >= f.min && bp <= f.max && f.parent) {
      featureObj = f
    }
    if (!featureObj) {
      continue
    }
    if (
      featureTypeOntology.isTypeOf(featureObj.type, 'CDS') &&
      featureObj.parent &&
      (featureTypeOntology.isTypeOf(featureObj.parent.type, 'transcript') ||
        featureTypeOntology.isTypeOf(
          featureObj.parent.type,
          'pseudogenic_transcript',
        ))
    ) {
      const { cdsLocations } = featureObj.parent
      for (const cdsLoc of cdsLocations) {
        for (const loc of cdsLoc) {
          if (bp >= loc.min && bp <= loc.max) {
            return featureObj
          }
        }
      }

      // If mouse position is in the intron region, return the transcript
      return featureObj.parent
    }
    // If mouse position is in a feature that is not a CDS, return the feature
    return featureObj
  }
  return feature
}

function getCDSCount(
  feature: AnnotationFeature,
  featureTypeOntology: OntologyRecord,
): number {
  const { children, type } = feature
  if (!children) {
    return 0
  }
  const isMrna = featureTypeOntology.isTypeOf(type, 'transcript')
  let cdsCount = 0
  if (isMrna) {
    for (const [, child] of children) {
      if (featureTypeOntology.isTypeOf(child.type, 'CDS')) {
        cdsCount += 1
      }
    }
  }
  return cdsCount
}

function getRowCount(
  feature: AnnotationFeature,
  featureTypeOntology: OntologyRecord,
  _bpPerPx?: number,
): number {
  const { children, type } = feature
  if (!children) {
    return 1
  }
  const isTranscript =
    featureTypeOntology.isTypeOf(type, 'transcript') ||
    featureTypeOntology.isTypeOf(type, 'pseudogenic_transcript')
  let rowCount = 0
  if (isTranscript) {
    for (const [, child] of children) {
      if (featureTypeOntology.isTypeOf(child.type, 'CDS')) {
        rowCount += 1
      }
    }

    // return 1 if there are no CDSs for non coding genes
    return rowCount === 0 ? 1 : rowCount
  }
  for (const [, child] of children) {
    rowCount += getRowCount(child, featureTypeOntology)
  }
  return rowCount
}

/**
 * A list of all the subfeatures for each row for a given feature, as well as
 * the feature itself.
 * If the row contains a transcript, the order is CDS -\> exon -\> transcript -\> gene
 * If the row does not contain an transcript, the order is subfeature -\> gene
 */
function featuresForRow(
  feature: AnnotationFeature,
  featureTypeOntology: OntologyRecord,
): AnnotationFeature[][] {
  const isGene =
    featureTypeOntology.isTypeOf(feature.type, 'gene') ||
    featureTypeOntology.isTypeOf(feature.type, 'pseudogene')
  if (!isGene) {
    throw new Error('Top level feature for GeneGlyph must have type "gene"')
  }
  const { children } = feature
  if (!children) {
    return [[feature]]
  }
  const features: AnnotationFeature[][] = []
  for (const [, child] of children) {
    if (
      !(
        featureTypeOntology.isTypeOf(child.type, 'transcript') ||
        featureTypeOntology.isTypeOf(child.type, 'pseudogenic_transcript')
      )
    ) {
      features.push([child, feature])
      continue
    }
    if (!child.children) {
      continue
    }
    const cdss: AnnotationFeature[] = []
    const exons: AnnotationFeature[] = []
    for (const [, grandchild] of child.children) {
      if (featureTypeOntology.isTypeOf(grandchild.type, 'CDS')) {
        cdss.push(grandchild)
      } else if (featureTypeOntology.isTypeOf(grandchild.type, 'exon')) {
        exons.push(grandchild)
      }
    }
    for (const cds of cdss) {
      features.push([cds, ...exons, child, feature])
    }
    if (cdss.length === 0) {
      features.push([...exons, child, feature])
    }
  }
  return features
}

function getRowForFeature(
  feature: AnnotationFeature,
  childFeature: AnnotationFeature,
  featureTypeOntology: OntologyRecord,
) {
  const rows = featuresForRow(feature, featureTypeOntology)
  for (const [idx, row] of rows.entries()) {
    if (row.some((feature) => feature._id === childFeature._id)) {
      return idx
    }
  }
  return
}

function onMouseDown(
  display: LinearApolloDisplay,
  currentMousePosition: MousePositionWithFeature,
  event: CanvasMouseEvent,
) {
  const { feature } = currentMousePosition
  // swallow the mouseDown if we are on the edge of the feature so that we
  // don't start dragging the view if we try to drag the feature edge
  const draggableFeature = getDraggableFeatureInfo(
    currentMousePosition,
    feature,
    display,
  )
  if (draggableFeature) {
    event.stopPropagation()
    display.startDrag(
      currentMousePosition,
      draggableFeature.feature,
      draggableFeature.edge,
      true,
    )
  }
}

function onMouseMove(
  display: LinearApolloDisplay,
  mousePosition: MousePosition,
) {
  if (isMousePositionWithFeature(mousePosition)) {
    const { feature, bp } = mousePosition
    display.setHoveredFeature({ feature, bp })
    const draggableFeature = getDraggableFeatureInfo(
      mousePosition,
      feature,
      display,
    )
    if (draggableFeature) {
      display.setCursor('col-resize')
      return
    }
  }
  display.setCursor()
}

function onMouseUp(display: LinearApolloDisplay, mousePosition: MousePosition) {
  if (display.apolloDragging) {
    return
  }
  const { feature } = mousePosition
  if (!feature) {
    return
  }
  selectFeatureAndOpenWidget(display, feature)
}

function getDraggableFeatureInfo(
  mousePosition: MousePosition,
  feature: AnnotationFeature,
  disply: LinearApolloDisplay,
): { feature: AnnotationFeature; edge: 'min' | 'max' } | undefined {
  const { session } = disply
  const { apolloDataStore } = session
  const { featureTypeOntology } = apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  const isGene =
    featureTypeOntology.isTypeOf(feature.type, 'gene') ||
    featureTypeOntology.isTypeOf(feature.type, 'pseudogene')
  const isTranscript =
    featureTypeOntology.isTypeOf(feature.type, 'transcript') ||
    featureTypeOntology.isTypeOf(feature.type, 'pseudogenic_transcript')
  const isCDS = featureTypeOntology.isTypeOf(feature.type, 'CDS')
  if (isGene || isTranscript) {
    // For gene glyphs, the sizes of genes and transcripts are determined by
    // their child exons, so we don't make them draggable
    return
  }
  // So now the type of feature is either CDS or exon. If an exon and CDS edge
  // are in the same place, we want to prioritize dragging the exon. If the
  // feature we're on is a CDS, let's find any exon it may overlap.
  const { bp, refName, regionNumber, x } = mousePosition
  const { lgv } = disply
  if (isCDS) {
    const transcript = feature.parent
    if (!transcript?.children) {
      return
    }
    const exonChildren: AnnotationFeature[] = []
    for (const child of transcript.children.values()) {
      const childIsExon = featureTypeOntology.isTypeOf(child.type, 'exon')
      if (childIsExon) {
        exonChildren.push(child)
      }
    }
    const overlappingExon = exonChildren.find((child) => {
      const [start, end] = intersection2(bp - 1, bp, child.min, child.max)
      return start !== undefined && end !== undefined
    })
    if (overlappingExon) {
      // We are on an exon, are we on the edge of it?
      const minMax = getMinAndMaxPx(overlappingExon, refName, regionNumber, lgv)
      if (minMax) {
        const overlappingEdge = getOverlappingEdge(overlappingExon, x, minMax)
        if (overlappingEdge) {
          return overlappingEdge
        }
      }
    }
  }
  // End of special cases, let's see if we're on the edge of this CDS or exon
  const minMax = getMinAndMaxPx(feature, refName, regionNumber, lgv)
  if (minMax) {
    const overlappingEdge = getOverlappingEdge(feature, x, minMax)
    if (overlappingEdge) {
      return overlappingEdge
    }
  }
  return
}

function getContextMenuItems(
  display: LinearApolloDisplayMouseEvents,
  mousePosition: MousePositionWithFeature,
): MenuItem[] {
  const {
    apolloInternetAccount: internetAccount,
    hoveredFeature,
    changeManager,
    regions,
    selectedFeature,
    session,
  } = display
  const [region] = regions
  const currentAssemblyId = display.getAssemblyId(region.assemblyName)
  const menuItems: MenuItem[] = []
  const role = internetAccount ? internetAccount.role : 'admin'
  const admin = role === 'admin'
  if (!hoveredFeature) {
    return menuItems
  }

  if (isMousePositionWithFeature(mousePosition)) {
    const { bp, feature } = mousePosition
    let featuresUnderClick = getRelatedFeatures(feature, bp)
    if (isCDSFeature(feature, session)) {
      featuresUnderClick = getRelatedFeatures(feature, bp, true)
    }

    for (const feature of featuresUnderClick) {
      const contextMenuItemsForFeature = getContextMenuItemsForFeature(
        display,
        feature,
      )
      if (isExonFeature(feature, session)) {
        const adjacentExons = getAdjacentExons(
          feature,
          display,
          mousePosition,
          session,
        )
        const lgv = getContainingView(
          display as BaseDisplayModel,
        ) as unknown as LinearGenomeViewModel
        if (adjacentExons.upstream) {
          const exon = adjacentExons.upstream
          contextMenuItemsForFeature.push({
            label: 'Go to upstream exon',
            icon: getStreamIcon(
              feature.strand,
              true,
              lgv.displayedRegions.at(0)?.reversed,
            ),
            onClick: () => {
              lgv.navTo(navToFeatureCenter(exon, 0.1, lgv.totalBp))
              selectFeatureAndOpenWidget(display, exon)
            },
          })
        }
        if (adjacentExons.downstream) {
          const exon = adjacentExons.downstream
          contextMenuItemsForFeature.push({
            label: 'Go to downstream exon',
            icon: getStreamIcon(
              feature.strand,
              false,
              lgv.displayedRegions.at(0)?.reversed,
            ),
            onClick: () => {
              lgv.navTo(navToFeatureCenter(exon, 0.1, lgv.totalBp))
              selectFeatureAndOpenWidget(display, exon)
            },
          })
        }
        contextMenuItemsForFeature.push(
          {
            label: 'Merge exons',
            disabled: !admin,
            onClick: () => {
              ;(session as unknown as AbstractSessionModel).queueDialog(
                (doneCallback) => [
                  MergeExons,
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
          },
          {
            label: 'Split exon',
            disabled: !admin,
            onClick: () => {
              ;(session as unknown as AbstractSessionModel).queueDialog(
                (doneCallback) => [
                  SplitExon,
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
          },
        )
      }
      if (isTranscriptFeature(feature, session)) {
        contextMenuItemsForFeature.push({
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
        if (isSessionModelWithWidgets(session)) {
          contextMenuItemsForFeature.push({
            label: 'Open transcript details',
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
      }
      menuItems.push({
        label: feature.type,
        subMenu: contextMenuItemsForFeature,
      })
    }
  }
  return menuItems
}

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const { drawTooltip, onMouseLeave } = boxGlyph
/* eslint-enable @typescript-eslint/unbound-method */

export const geneGlyph: Glyph = {
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
