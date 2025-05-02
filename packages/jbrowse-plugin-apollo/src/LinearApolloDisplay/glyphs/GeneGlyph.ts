import { AnnotationFeature } from '@apollo-annotation/mst'
import { getFrame, intersection2 } from '@jbrowse/core/util'
import { alpha } from '@mui/material'

import { LinearApolloDisplay } from '../stateModel'
import {
  isMousePositionWithFeatureAndGlyph,
  MousePosition,
  MousePositionWithFeatureAndGlyph,
} from '../stateModel/mouseEvents'
import { CanvasMouseEvent } from '../types'
import { Glyph } from './Glyph'
import { boxGlyph } from './BoxGlyph'
import { LinearApolloDisplayRendering } from '../stateModel/rendering'
import { OntologyRecord } from '../../OntologyManager'

let forwardFillLight: CanvasPattern | null = null
let backwardFillLight: CanvasPattern | null = null
let forwardFillDark: CanvasPattern | null = null
let backwardFillDark: CanvasPattern | null = null
if ('document' in globalThis) {
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

function draw(
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  stateModel: LinearApolloDisplayRendering,
  displayedRegionIndex: number,
): void {
  const { apolloRowHeight, lgv, session, theme } = stateModel
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[displayedRegionIndex]
  const { refName, reversed } = displayedRegion
  const rowHeight = apolloRowHeight
  const cdsHeight = Math.round(0.9 * rowHeight)
  const { children, min, strand } = feature
  if (!children) {
    return
  }
  const { apolloSelectedFeature } = session
  const { apolloDataStore } = session
  const { featureTypeOntology } = apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }

  // Draw background for gene
  const topLevelFeatureMinX =
    (lgv.bpToPx({
      refName,
      coord: min,
      regionNumber: displayedRegionIndex,
    })?.offsetPx ?? 0) - offsetPx
  const topLevelFeatureWidthPx = feature.length / bpPerPx
  const topLevelFeatureStartPx = reversed
    ? topLevelFeatureMinX - topLevelFeatureWidthPx
    : topLevelFeatureMinX
  const topLevelFeatureTop = row * rowHeight
  const topLevelFeatureHeight =
    getRowCount(feature, featureTypeOntology) * rowHeight

  ctx.fillStyle = alpha(theme?.palette.background.paper ?? '#ffffff', 0.6)
  ctx.fillRect(
    topLevelFeatureStartPx,
    topLevelFeatureTop,
    topLevelFeatureWidthPx,
    topLevelFeatureHeight,
  )

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
      drawLine(
        ctx,
        stateModel,
        displayedRegionIndex,
        row,
        transcript,
        currentRow,
      )
      currentRow += 1
    }

    if (cdsCount === 0) {
      drawLine(
        ctx,
        stateModel,
        displayedRegionIndex,
        row,
        transcript,
        currentRow,
      )
      currentRow += 1
    }
  }

  const forwardFill =
    theme?.palette.mode === 'dark' ? forwardFillDark : forwardFillLight
  const backwardFill =
    theme?.palette.mode === 'dark' ? backwardFillDark : backwardFillLight
  // Draw exon and CDS for each transcript
  currentRow = 0
  for (const [, child] of children) {
    if (
      !(
        featureTypeOntology.isTypeOf(child.type, 'transcript') ||
        featureTypeOntology.isTypeOf(child.type, 'pseudogenic_transcript')
      )
    ) {
      boxGlyph.draw(ctx, child, row, stateModel, displayedRegionIndex)
      currentRow += 1
      continue
    }
    const cdsCount = getCDSCount(child, featureTypeOntology)
    if (cdsCount != 0) {
      for (const cdsRow of child.cdsLocations) {
        const { _id, children: transcriptChildren } = child
        if (!transcriptChildren) {
          continue
        }
        for (const [, exon] of transcriptChildren) {
          if (!featureTypeOntology.isTypeOf(exon.type, 'exon')) {
            continue
          }
          drawExon(
            ctx,
            stateModel,
            displayedRegionIndex,
            row,
            exon,
            currentRow,
            strand,
            forwardFill,
            backwardFill,
          )
        }
        for (const cds of cdsRow) {
          const cdsWidthPx = (cds.max - cds.min) / bpPerPx
          const minX =
            (lgv.bpToPx({
              refName,
              coord: cds.min,
              regionNumber: displayedRegionIndex,
            })?.offsetPx ?? 0) - offsetPx
          const cdsStartPx = reversed ? minX - cdsWidthPx : minX
          ctx.fillStyle = theme?.palette.text.primary ?? 'black'
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
            const frameColor = theme?.palette.framesCDS.at(frame)?.main
            const cdsColorCode = frameColor ?? 'rgb(171,71,188)'
            ctx.fillStyle =
              apolloSelectedFeature && _id === apolloSelectedFeature._id
                ? 'rgb(0,0,0)'
                : cdsColorCode
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
          ctx,
          stateModel,
          displayedRegionIndex,
          row,
          exon,
          currentRow,
          strand,
          forwardFill,
          backwardFill,
        )
      }
      currentRow += 1
    }
  }
}

function drawExon(
  ctx: CanvasRenderingContext2D,
  stateModel: LinearApolloDisplayRendering,
  displayedRegionIndex: number,
  row: number,
  exon: AnnotationFeature,
  currentRow: number,
  strand: number | undefined,
  forwardFill: CanvasPattern | null,
  backwardFill: CanvasPattern | null,
) {
  const { apolloRowHeight, lgv, session, theme } = stateModel
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[displayedRegionIndex]
  const { refName, reversed } = displayedRegion
  const { apolloSelectedFeature } = session

  const minX =
    (lgv.bpToPx({
      refName,
      coord: exon.min,
      regionNumber: displayedRegionIndex,
    })?.offsetPx ?? 0) - offsetPx
  const widthPx = exon.length / bpPerPx
  const startPx = reversed ? minX - widthPx : minX

  const top = (row + currentRow) * apolloRowHeight
  const exonHeight = Math.round(0.6 * apolloRowHeight)
  const exonTop = top + (apolloRowHeight - exonHeight) / 2
  ctx.fillStyle = theme?.palette.text.primary ?? 'black'
  ctx.fillRect(startPx, exonTop, widthPx, exonHeight)
  if (widthPx > 2) {
    ctx.clearRect(startPx + 1, exonTop + 1, widthPx - 2, exonHeight - 2)
    ctx.fillStyle =
      apolloSelectedFeature && exon._id === apolloSelectedFeature._id
        ? 'rgb(0,0,0)'
        : 'rgb(211,211,211)'
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

function drawLine(
  ctx: CanvasRenderingContext2D,
  stateModel: LinearApolloDisplayRendering,
  displayedRegionIndex: number,
  row: number,
  transcript: AnnotationFeature,
  currentRow: number,
) {
  const { apolloRowHeight, lgv, theme } = stateModel
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[displayedRegionIndex]
  const { refName, reversed } = displayedRegion
  const minX =
    (lgv.bpToPx({
      refName,
      coord: transcript.min,
      regionNumber: displayedRegionIndex,
    })?.offsetPx ?? 0) - offsetPx
  const widthPx = transcript.length / bpPerPx
  const startPx = reversed ? minX - widthPx : minX
  const height =
    Math.round((currentRow + 1 / 2) * apolloRowHeight) + row * apolloRowHeight
  ctx.strokeStyle = theme?.palette.text.primary ?? 'black'
  ctx.beginPath()
  ctx.moveTo(startPx, height)
  ctx.lineTo(startPx + widthPx, height)
  ctx.stroke()
}

function drawDragPreview(
  stateModel: LinearApolloDisplay,
  overlayCtx: CanvasRenderingContext2D,
) {
  const { apolloDragging, apolloRowHeight, lgv, theme } = stateModel
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
  overlayCtx.strokeStyle = theme?.palette.info.main ?? 'rgb(255,0,0)'
  overlayCtx.setLineDash([6])
  overlayCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
  overlayCtx.fillStyle = alpha(theme?.palette.info.main ?? 'rgb(255,0,0)', 0.2)
  overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight)
}

function drawHover(
  stateModel: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
) {
  const { apolloHover, apolloRowHeight, lgv, session, theme } = stateModel
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager

  if (!apolloHover) {
    return
  }
  const { feature } = apolloHover
  const position = stateModel.getFeatureLayoutPosition(feature)
  if (!position) {
    return
  }
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const { featureRow, layoutIndex, layoutRow } = position
  const displayedRegion = displayedRegions[layoutIndex]
  const { refName, reversed } = displayedRegion
  const { length, max, min } = feature
  const startPx =
    (lgv.bpToPx({
      refName,
      coord: reversed ? max : min,
      regionNumber: layoutIndex,
    })?.offsetPx ?? 0) - offsetPx
  const row = layoutRow + featureRow
  const top = row * apolloRowHeight
  const widthPx = length / bpPerPx
  ctx.fillStyle = theme?.palette.action.selected ?? 'rgba(0,0,0,04)'

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
  stateModel: LinearApolloDisplay,
  currentMousePosition: MousePositionWithFeatureAndGlyph,
  event: CanvasMouseEvent,
) {
  const { featureAndGlyphUnderMouse } = currentMousePosition
  // swallow the mouseDown if we are on the edge of the feature so that we
  // don't start dragging the view if we try to drag the feature edge
  const { feature } = featureAndGlyphUnderMouse
  const draggableFeature = getDraggableFeatureInfo(
    currentMousePosition,
    feature,
    stateModel,
  )
  if (draggableFeature) {
    event.stopPropagation()
    stateModel.startDrag(
      currentMousePosition,
      draggableFeature.feature,
      draggableFeature.edge,
    )
  }
}

function onMouseMove(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePosition,
) {
  if (isMousePositionWithFeatureAndGlyph(mousePosition)) {
    const { featureAndGlyphUnderMouse } = mousePosition
    stateModel.setApolloHover(featureAndGlyphUnderMouse)
    const { feature } = featureAndGlyphUnderMouse
    const draggableFeature = getDraggableFeatureInfo(
      mousePosition,
      feature,
      stateModel,
    )
    if (draggableFeature) {
      stateModel.setCursor('col-resize')
      return
    }
  }
  stateModel.setCursor()
}

function onMouseUp(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePosition,
) {
  if (stateModel.apolloDragging) {
    return
  }
  const { featureAndGlyphUnderMouse } = mousePosition
  if (featureAndGlyphUnderMouse?.feature) {
    stateModel.setSelectedFeature(featureAndGlyphUnderMouse.feature)
  }
}

function getDraggableFeatureInfo(
  mousePosition: MousePosition,
  feature: AnnotationFeature,
  stateModel: LinearApolloDisplay,
): { feature: AnnotationFeature; edge: 'min' | 'max' } | undefined {
  const { session } = stateModel
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
  const isCds = featureTypeOntology.isTypeOf(feature.type, 'CDS')
  if (isGene || isTranscript) {
    return
  }
  const { bp, refName, regionNumber, x } = mousePosition
  const { lgv } = stateModel
  const { offsetPx } = lgv

  const minPxInfo = lgv.bpToPx({ refName, coord: feature.min, regionNumber })
  const maxPxInfo = lgv.bpToPx({ refName, coord: feature.max, regionNumber })
  if (minPxInfo === undefined || maxPxInfo === undefined) {
    return
  }
  const minPx = minPxInfo.offsetPx - offsetPx
  const maxPx = maxPxInfo.offsetPx - offsetPx
  if (Math.abs(maxPx - minPx) < 8) {
    return
  }
  if (Math.abs(minPx - x) < 4) {
    return { feature, edge: 'min' }
  }
  if (Math.abs(maxPx - x) < 4) {
    return { feature, edge: 'max' }
  }
  if (isCds) {
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

    if (!overlappingExon) {
      return
    }
    const minPxInfo = lgv.bpToPx({
      refName,
      coord: overlappingExon.min,
      regionNumber,
    })
    const maxPxInfo = lgv.bpToPx({
      refName,
      coord: overlappingExon.max,
      regionNumber,
    })
    if (minPxInfo === undefined || maxPxInfo === undefined) {
      return
    }
    const minPx = minPxInfo.offsetPx - offsetPx
    const maxPx = maxPxInfo.offsetPx - offsetPx
    if (Math.abs(maxPx - minPx) < 8) {
      return
    }
    if (Math.abs(minPx - x) < 4) {
      return { feature: overlappingExon, edge: 'min' }
    }
    if (Math.abs(maxPx - x) < 4) {
      return { feature: overlappingExon, edge: 'max' }
    }
  }
  return
}

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const { drawTooltip, getContextMenuItems, onMouseLeave } = boxGlyph
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
