import {
  type AnnotationFeature,
  type TranscriptPartCoding,
} from '@apollo-annotation/mst'
import { type MenuItem } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  getFrame,
  intersection2,
  measureText,
} from '@jbrowse/core/util'
import { alpha } from '@mui/material'
import equal from 'fast-deep-equal/es6'
import { getSnapshot } from 'mobx-state-tree'

import { MergeExons, SplitExon } from '../../components'
import { FilterTranscripts } from '../../components/FilterTranscripts'
import {
  getContextMenuItemsForFeature,
  getMinAndMaxPx,
  getOverlappingEdge,
  getRelatedFeatures,
  isSelectedFeature,
} from '../../util'
import { type LinearApolloSixFrameDisplay } from '../stateModel'
import {
  type LinearApolloSixFrameDisplayMouseEvents,
  type MousePosition,
  type MousePositionWithFeature,
  isMousePositionWithFeature,
} from '../stateModel/mouseEvents'
import { type LinearApolloSixFrameDisplayRendering } from '../stateModel/rendering'
import { type CanvasMouseEvent } from '../types'

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

function deepSetHas<T>(set: Set<T>, item: T): boolean {
  for (const elem of set) {
    if (equal(elem, item)) {
      return true
    }
  }
  return false
}

interface Label {
  x: number
  y: number
  h: number
  text: string | undefined
  color: string
  isSelected: boolean
}

function drawTextLabels(
  ctx: CanvasRenderingContext2D,
  labelArray: Label[],
  font = '10px sans-serif',
) {
  for (let i = labelArray.length - 1; i >= 0; --i) {
    const label = labelArray[i]
    ctx.fillStyle = label.color
    const labelRowX = Math.max(label.x + 1, 0)
    const labelRowY = label.y + label.h
    const textWidth = measureText(label.text, 10)
    if (label.isSelected) {
      ctx.clearRect(labelRowX - 5, labelRowY, textWidth + 10, label.h)
      ctx.font = 'bold '.concat(font)
    }
    if (label.text) {
      ctx.fillText(label.text, labelRowX, labelRowY + 11, textWidth)
      ctx.font = font
    }
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  topLevelFeature: AnnotationFeature,
  _row: number,
  stateModel: LinearApolloSixFrameDisplayRendering,
  displayedRegionIndex: number,
): void {
  const {
    apolloRowHeight,
    lgv,
    session,
    theme,
    highestRow,
    filteredTranscripts,
    selectedFeature,
    showFeatureLabels,
  } = stateModel
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[displayedRegionIndex]
  const { refName, reversed } = displayedRegion
  const rowHeight = apolloRowHeight
  const exonHeight = rowHeight
  const cdsHeight = rowHeight
  const topLevelFeatureHeight = rowHeight
  const featureLabelSpacer = showFeatureLabels ? 2 : 1
  const textColor = theme?.palette.text.primary ?? 'black'
  const { attributes, children, min, strand } = topLevelFeature
  if (!children) {
    return
  }
  const { apolloDataStore } = session
  const { featureTypeOntology } = apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  const labelArray: Label[] = []

  // Draw background for gene
  const topLevelFeatureMinX =
    (lgv.bpToPx({
      refName,
      coord: min,
      regionNumber: displayedRegionIndex,
    })?.offsetPx ?? 0) - offsetPx
  const topLevelFeatureWidthPx = topLevelFeature.length / bpPerPx
  const topLevelFeatureStartPx = reversed
    ? topLevelFeatureMinX - topLevelFeatureWidthPx
    : topLevelFeatureMinX
  const topLevelRow = (strand == 1 ? 3 : 4) * featureLabelSpacer
  const topLevelFeatureTop = topLevelRow * rowHeight
  ctx.fillStyle = theme?.palette.text.primary ?? 'black'
  ctx.fillRect(
    topLevelFeatureStartPx,
    topLevelFeatureTop,
    topLevelFeatureWidthPx,
    topLevelFeatureHeight,
  )

  ctx.fillStyle = isSelectedFeature(topLevelFeature, selectedFeature)
    ? alpha('rgb(0,0,0)', 0.7)
    : alpha(theme?.palette.background.paper ?? '#ffffff', 0.7)
  ctx.fillRect(
    topLevelFeatureStartPx + 1,
    topLevelFeatureTop + 1,
    topLevelFeatureWidthPx - 2,
    topLevelFeatureHeight - 2,
  )

  const isSelected = isSelectedFeature(topLevelFeature, selectedFeature)
  const label: Label = {
    x: topLevelFeatureStartPx,
    y: topLevelFeatureTop,
    h: topLevelFeatureHeight,
    text: attributes.get('gff_id')?.toString(),
    color: textColor,
    isSelected,
  }
  if (isSelected) {
    labelArray.unshift(label)
  } else {
    labelArray.push(label)
  }

  const forwardFill =
    theme?.palette.mode === 'dark' ? forwardFillDark : forwardFillLight
  const backwardFill =
    theme?.palette.mode === 'dark' ? backwardFillDark : backwardFillLight
  const reversal = reversed ? -1 : 1
  let topFill: CanvasPattern | null = null,
    bottomFill: CanvasPattern | null = null
  if (strand) {
    ;[topFill, bottomFill] =
      strand * reversal === 1
        ? [forwardFill, backwardFill]
        : [backwardFill, forwardFill]
  }

  if (topFill && bottomFill) {
    ctx.fillStyle = topFill
    ctx.fillRect(
      topLevelFeatureStartPx + 1,
      topLevelFeatureTop + 1,
      topLevelFeatureWidthPx - 2,
      (topLevelFeatureHeight - 2) / 2,
    )
    ctx.fillStyle = bottomFill
    ctx.fillRect(
      topLevelFeatureStartPx + 1,
      topLevelFeatureTop + (topLevelFeatureHeight - 2) / 2,
      topLevelFeatureWidthPx - 2,
      (topLevelFeatureHeight - 2) / 2,
    )
  }

  const renderedCDS = new Set<TranscriptPartCoding>()
  // Draw exon and CDS for each mRNA
  for (const [, child] of children) {
    if (
      !(
        featureTypeOntology.isTypeOf(child.type, 'transcript') ||
        featureTypeOntology.isTypeOf(child.type, 'pseudogenic_transcript')
      )
    ) {
      continue
    }
    const { children: childrenOfmRNA, cdsLocations } = child
    if (!childrenOfmRNA) {
      continue
    }
    const childID: string | undefined = child.attributes
      .get('gff_id')
      ?.toString()
    if (childID && filteredTranscripts.includes(childID)) {
      continue
    }
    for (const [, exon] of childrenOfmRNA) {
      if (!featureTypeOntology.isTypeOf(exon.type, 'exon')) {
        continue
      }
      const minX =
        (lgv.bpToPx({
          refName,
          coord: exon.min,
          regionNumber: displayedRegionIndex,
        })?.offsetPx ?? 0) - offsetPx
      const widthPx = exon.length / bpPerPx
      const startPx = reversed ? minX - widthPx : minX

      const exonTop =
        topLevelFeatureTop + (topLevelFeatureHeight - exonHeight) / 2
      const isSelected = isSelectedFeature(exon, selectedFeature)
      ctx.fillStyle = theme?.palette.text.primary ?? 'black'
      ctx.fillRect(startPx, exonTop, widthPx, exonHeight)
      if (widthPx > 2) {
        ctx.clearRect(startPx + 1, exonTop + 1, widthPx - 2, exonHeight - 2)
        ctx.fillStyle = isSelected ? 'rgb(0,0,0)' : alpha('#f5f500', 0.6)
        ctx.fillRect(startPx + 1, exonTop + 1, widthPx - 2, exonHeight - 2)
        if (topFill && bottomFill) {
          ctx.fillStyle = topFill
          ctx.fillRect(
            startPx + 1,
            exonTop + 1,
            widthPx - 2,
            (exonHeight - 2) / 2,
          )
          ctx.fillStyle = bottomFill
          ctx.fillRect(
            startPx + 1,
            exonTop + 1 + (exonHeight - 2) / 2,
            widthPx - 2,
            (exonHeight - 2) / 2,
          )
        }

        const label: Label = {
          x: startPx,
          y: exonTop,
          h: exonHeight,
          text: exon.attributes.get('gff_id')?.toString(),
          color: textColor,
          isSelected,
        }
        if (isSelected) {
          labelArray.unshift(label)
        } else {
          labelArray.push(label)
        }
      }
    }

    const isSelected = isSelectedFeature(child, selectedFeature?.parent)
    let cdsStartPx = 0
    let cdsTop = 0
    for (const cdsRow of cdsLocations) {
      let prevCDSTop = 0
      let prevCDSEndPx = 0
      let counter = 1
      for (const cds of cdsRow.sort((a, b) => a.max - b.max)) {
        if (
          (selectedFeature &&
            isSelected &&
            featureTypeOntology.isTypeOf(selectedFeature.type, 'CDS')) ||
          !deepSetHas(renderedCDS, cds)
        ) {
          const cdsWidthPx = (cds.max - cds.min) / bpPerPx
          const minX =
            (lgv.bpToPx({
              refName,
              coord: cds.min,
              regionNumber: displayedRegionIndex,
            })?.offsetPx ?? 0) - offsetPx
          cdsStartPx = reversed ? minX - cdsWidthPx : minX
          ctx.fillStyle = theme?.palette.text.primary ?? 'black'
          const frame = getFrame(cds.min, cds.max, child.strand ?? 1, cds.phase)
          const frameAdjust =
            (frame < 0 ? -1 * frame + 5 : frame) * featureLabelSpacer
          cdsTop = (frameAdjust - featureLabelSpacer) * rowHeight
          ctx.fillRect(cdsStartPx, cdsTop, cdsWidthPx, cdsHeight)
          if (cdsWidthPx > 2) {
            ctx.clearRect(
              cdsStartPx + 1,
              cdsTop + 1,
              cdsWidthPx - 2,
              cdsHeight - 2,
            )

            const frameColor = theme?.palette.framesCDS.at(frame)?.main
            const cdsColorCode = frameColor ?? 'rgb(171,71,188)'
            ctx.fillStyle = cdsColorCode
            ctx.fillStyle =
              selectedFeature &&
              isSelected &&
              featureTypeOntology.isTypeOf(selectedFeature.type, 'CDS')
                ? 'rgb(0,0,0)'
                : cdsColorCode
            ctx.fillRect(
              cdsStartPx + 1,
              cdsTop + 1,
              cdsWidthPx - 2,
              cdsHeight - 2,
            )

            // Draw lines to connect CDS features with shared mRNA parent
            if (counter > 1) {
              // Mid-point for intron line "hat"
              const midPoint: [number, number] = [
                (cdsStartPx - prevCDSEndPx) / 2 + prevCDSEndPx,
                Math.max(
                  frame < 0
                    ? rowHeight * featureLabelSpacer * highestRow + 1
                    : 1, // Avoid render ceiling
                  Math.min(prevCDSTop, cdsTop) - rowHeight / 2,
                ),
              ]
              ctx.strokeStyle = 'rgb(0, 128, 128)'
              ctx.beginPath()
              ctx.moveTo(prevCDSEndPx, prevCDSTop)
              ctx.lineTo(...midPoint)
              ctx.stroke()
              ctx.moveTo(...midPoint)
              ctx.lineTo(cdsStartPx, cdsTop + rowHeight / 2)
              ctx.stroke()
            }
            prevCDSEndPx = cdsStartPx + cdsWidthPx
            prevCDSTop = cdsTop + rowHeight / 2
            counter += 1

            if (topFill && bottomFill) {
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
          renderedCDS.add(cds)
        }
      }
    }
    const label: Label = {
      x: cdsStartPx,
      y: cdsTop,
      h: cdsHeight,
      text: child.attributes.get('gff_id')?.toString(),
      color: textColor,
      isSelected,
    }
    if (isSelected) {
      labelArray.unshift(label)
    } else {
      labelArray.push(label)
    }
  }
  if (showFeatureLabels) {
    drawTextLabels(ctx, labelArray)
  }
}

function drawDragPreview(
  stateModel: LinearApolloSixFrameDisplay,
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
  stateModel: LinearApolloSixFrameDisplay,
  ctx: CanvasRenderingContext2D,
) {
  const {
    hoveredFeature,
    apolloRowHeight,
    filteredTranscripts,
    lgv,
    highestRow,
    session,
    showFeatureLabels,
  } = stateModel
  if (!hoveredFeature) {
    return
  }
  const { apolloDataStore } = session
  const { featureTypeOntology } = apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  if (!featureTypeOntology.isTypeOf(hoveredFeature.type, 'transcript')) {
    return
  }
  const featureID: string | undefined = hoveredFeature.attributes
    .get('gff_id')
    ?.toString()
  if (featureID && filteredTranscripts.includes(featureID)) {
    return
  }
  const position = stateModel.getFeatureLayoutPosition(hoveredFeature)
  if (!position) {
    return
  }
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const { layoutIndex } = position
  const displayedRegion = displayedRegions[layoutIndex]
  const { refName, reversed } = displayedRegion
  const rowHeight = apolloRowHeight
  const cdsHeight = rowHeight
  const featureLabelSpacer = showFeatureLabels ? 2 : 1
  const { cdsLocations, strand } = hoveredFeature
  for (const cdsRow of cdsLocations) {
    let prevCDSTop = 0
    let prevCDSEndPx = 0
    let counter = 1
    for (const cds of cdsRow.sort((a, b) => a.max - b.max)) {
      const cdsWidthPx = (cds.max - cds.min) / bpPerPx
      if (cdsWidthPx > 2) {
        const minX =
          (lgv.bpToPx({
            refName,
            coord: cds.min,
            regionNumber: layoutIndex,
          })?.offsetPx ?? 0) - offsetPx
        const cdsStartPx = reversed ? minX - cdsWidthPx : minX
        const frame = getFrame(cds.min, cds.max, strand ?? 1, cds.phase)
        const frameAdjust =
          (frame < 0 ? -1 * frame + 5 : frame) * featureLabelSpacer
        const cdsTop = (frameAdjust - featureLabelSpacer) * rowHeight
        ctx.fillStyle = 'rgba(255,0,0,0.6)'
        ctx.fillRect(cdsStartPx, cdsTop, cdsWidthPx, cdsHeight)

        if (counter > 1) {
          // Mid-point for intron line "hat"
          const midPoint: [number, number] = [
            (cdsStartPx - prevCDSEndPx) / 2 + prevCDSEndPx,
            Math.max(
              frame < 0 ? rowHeight * featureLabelSpacer * highestRow + 1 : 1, // Avoid render ceiling
              Math.min(prevCDSTop, cdsTop) - rowHeight / 2,
            ),
          ]
          ctx.strokeStyle = 'rgb(0, 0, 0)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(prevCDSEndPx, prevCDSTop)
          ctx.lineTo(...midPoint)
          ctx.stroke()
          ctx.moveTo(...midPoint)
          ctx.lineTo(cdsStartPx, cdsTop + rowHeight / 2)
          ctx.stroke()
        }
        prevCDSEndPx = cdsStartPx + cdsWidthPx
        prevCDSTop = cdsTop + rowHeight / 2
        counter += 1
      }
    }
  }
}

function onMouseDown(
  stateModel: LinearApolloSixFrameDisplay,
  currentMousePosition: MousePositionWithFeature,
  event: CanvasMouseEvent,
) {
  const { feature } = currentMousePosition
  // swallow the mouseDown if we are on the edge of the feature so that we
  // don't start dragging the view if we try to drag the feature edge
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
      true,
    )
  }
}

function onMouseMove(
  stateModel: LinearApolloSixFrameDisplay,
  mousePosition: MousePosition,
) {
  if (isMousePositionWithFeature(mousePosition)) {
    const { feature } = mousePosition
    stateModel.setHoveredFeature(feature)
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
  stateModel: LinearApolloSixFrameDisplay,
  mousePosition: MousePosition,
) {
  if (stateModel.apolloDragging) {
    return
  }
  if (isMousePositionWithFeature(mousePosition)) {
    const { feature } = mousePosition
    const { session } = stateModel
    const { apolloDataStore } = session
    const { featureTypeOntology } = apolloDataStore.ontologyManager
    stateModel.setSelectedFeature(feature)
    if (!featureTypeOntology) {
      throw new Error('featureTypeOntology is undefined')
    }

    let containsCDSOrExon = false
    for (const [, child] of feature.children ?? []) {
      if (
        featureTypeOntology.isTypeOf(child.type, 'CDS') ||
        featureTypeOntology.isTypeOf(child.type, 'exon')
      ) {
        containsCDSOrExon = true
        break
      }
    }
    if (
      (featureTypeOntology.isTypeOf(feature.type, 'transcript') ||
        featureTypeOntology.isTypeOf(feature.type, 'pseudogenic_transcript')) &&
      containsCDSOrExon
    ) {
      stateModel.showFeatureDetailsWidget(feature, [
        'ApolloTranscriptDetails',
        'apolloTranscriptDetails',
      ])
    } else {
      stateModel.showFeatureDetailsWidget(feature)
    }
  }
}

function getDraggableFeatureInfo(
  mousePosition: MousePosition,
  feature: AnnotationFeature,
  stateModel: LinearApolloSixFrameDisplay,
): { feature: AnnotationFeature; edge: 'min' | 'max' } | undefined {
  const { filteredTranscripts, session } = stateModel
  const { apolloDataStore } = session
  const { featureTypeOntology } = apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  const isTranscript = featureTypeOntology.isTypeOf(feature.type, 'transcript')
  const featureID: string | undefined = feature.attributes
    .get('gff_id')
    ?.toString()
  if (featureID && filteredTranscripts.includes(featureID)) {
    return
  }
  const { bp, refName, regionNumber, x } = mousePosition
  const { lgv } = stateModel
  if (isTranscript) {
    const transcript = feature
    if (!transcript.children) {
      return
    }
    const exonChildren: AnnotationFeature[] = []
    const cdsChildren: AnnotationFeature[] = []
    for (const child of transcript.children.values()) {
      const childIsExon = featureTypeOntology.isTypeOf(child.type, 'exon')
      const childIsCDS = featureTypeOntology.isTypeOf(child.type, 'CDS')
      if (childIsExon) {
        exonChildren.push(child)
      } else if (childIsCDS) {
        cdsChildren.push(child)
      }
    }
    const overlappingExon = exonChildren.find((child) => {
      const [start, end] = intersection2(bp, bp + 1, child.min, child.max)
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
    // End of special cases, let's see if we're on the edge of this CDS or exon
    for (const loc of transcript.cdsLocations) {
      for (const cds of loc) {
        const minMax = getMinAndMaxPx(cds, refName, regionNumber, lgv)
        if (minMax) {
          const overlappingCDS = cdsChildren.find((child) => {
            const [start, end] = intersection2(bp, bp + 1, child.min, child.max)
            return start !== undefined && end !== undefined
          })
          if (overlappingCDS) {
            const overlappingEdge = getOverlappingEdge(
              overlappingCDS,
              x,
              minMax,
            )
            if (overlappingEdge) {
              return overlappingEdge
            }
          }
        }
      }
    }
  }
  return
}

function drawTooltip(
  display: LinearApolloSixFrameDisplayMouseEvents,
  context: CanvasRenderingContext2D,
): void {
  const { hoveredFeature, apolloRowHeight, filteredTranscripts, lgv, theme } =
    display
  if (!hoveredFeature) {
    return
  }
  const { attributes, cds, strand, type } = hoveredFeature
  if (!cds) {
    return
  }
  const position = display.getFeatureLayoutPosition(hoveredFeature)
  if (!position) {
    return
  }
  const featureID: string | undefined = attributes.get('gff_id')?.toString()
  if (featureID && filteredTranscripts.includes(featureID)) {
    return
  }
  const { layoutIndex } = position
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[layoutIndex]
  const { refName, reversed } = displayedRegion
  const rowHeight = apolloRowHeight
  const cdsHeight = Math.round(0.7 * rowHeight)
  let location = 'Loc: '

  const { max, min, phase } = cds
  location += `${min + 1}–${max}`

  let startPx =
    (lgv.bpToPx({
      refName,
      coord: reversed ? max : min,
      regionNumber: layoutIndex,
    })?.offsetPx ?? 0) - offsetPx
  const frame = getFrame(min, max, strand ?? 1, phase)
  const frameAdjust = frame < 0 ? -1 * frame + 5 : frame
  const cdsTop = (frameAdjust - 1) * rowHeight + (rowHeight - cdsHeight) / 2
  const cdsWidthPx = (max - min) / bpPerPx

  const featureType = `Type: ${cds.type}`
  const featureName = attributes.get('gff_name')?.find((name) => name !== '')
  const textWidth = [
    context.measureText(featureType).width,
    context.measureText(location).width,
  ]
  if (featureName) {
    textWidth.push(
      context.measureText(`Parent Type: ${type}`).width,
      context.measureText(`Parent Name: ${featureName}`).width,
    )
  }
  const maxWidth = Math.max(...textWidth)

  startPx = startPx + cdsWidthPx + 5
  context.fillStyle = alpha(theme?.palette.text.primary ?? 'rgb(1, 1, 1)', 0.7)
  context.fillRect(
    startPx,
    cdsTop,
    maxWidth + 4,
    textWidth.length === 4 ? 55 : 35,
  )
  context.beginPath()
  context.moveTo(startPx, cdsTop)
  context.lineTo(startPx - 5, cdsTop + 5)
  context.lineTo(startPx, cdsTop + 10)
  context.fill()
  context.fillStyle = theme?.palette.background.default ?? 'rgba(255, 255, 255)'
  let textTop = cdsTop + 12
  context.fillText(featureType, startPx + 2, textTop)
  if (featureName) {
    textTop = textTop + 12
    context.fillText(`Parent Type: ${type}`, startPx + 2, textTop)
    textTop = textTop + 12
    context.fillText(`Parent Name: ${featureName}`, startPx + 2, textTop)
  }
  textTop = textTop + 12
  context.fillText(location, startPx + 2, textTop)
}

function getContextMenuItems(
  display: LinearApolloSixFrameDisplayMouseEvents,
  mousePosition: MousePositionWithFeature,
): MenuItem[] {
  const {
    apolloInternetAccount: internetAccount,
    hoveredFeature,
    changeManager,
    filteredTranscripts,
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
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  if (isMousePositionWithFeature(mousePosition)) {
    const { bp, feature } = mousePosition
    for (const relatedFeature of getRelatedFeatures(feature, bp)) {
      const featureID: string | undefined = relatedFeature.attributes
        .get('gff_id')
        ?.toString()
      if (featureID && filteredTranscripts.includes(featureID)) {
        continue
      }
      const contextMenuItemsForFeature = getContextMenuItemsForFeature(
        display,
        relatedFeature,
      )
      if (featureTypeOntology.isTypeOf(relatedFeature.type, 'exon')) {
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
                    sourceFeature: relatedFeature,
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
                    sourceFeature: relatedFeature,
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
      if (featureTypeOntology.isTypeOf(relatedFeature.type, 'gene')) {
        contextMenuItemsForFeature.push({
          label: 'Filter alternate transcripts',
          onClick: () => {
            ;(session as unknown as AbstractSessionModel).queueDialog(
              (doneCallback) => [
                FilterTranscripts,
                {
                  handleClose: () => {
                    doneCallback()
                  },
                  sourceFeature: relatedFeature,
                  filteredTranscripts: getSnapshot(filteredTranscripts),
                  onUpdate: (forms: string[]) => {
                    display.updateFilteredTranscripts(forms)
                  },
                },
              ],
            )
          },
        })
      }
      menuItems.push({
        label: relatedFeature.type,
        subMenu: contextMenuItemsForFeature,
      })
    }
  }
  return menuItems
}

function onMouseLeave(): void {
  return
}

export const geneGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  drawTooltip,
  getContextMenuItems,
  getContextMenuItemsForFeature,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
}
