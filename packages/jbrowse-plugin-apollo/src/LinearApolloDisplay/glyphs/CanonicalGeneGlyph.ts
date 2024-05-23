/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AnnotationFeatureNew } from '@apollo-annotation/mst'
import {
  DiscontinuousLocationEndChange,
  DiscontinuousLocationStartChange,
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import { alpha } from '@mui/material'

import { LinearApolloDisplay } from '../stateModel'
import {
  CDSDiscontinuousLocation,
  MousePosition,
} from '../stateModel/mouseEvents'
import { frameColors, getFrame } from '../stateModel/rendering'
import { CanvasMouseEvent } from '../types'
import { Glyph } from './Glyph'

type LocationChange =
  | DiscontinuousLocationEndChange
  | DiscontinuousLocationStartChange
  | LocationEndChange
  | LocationStartChange

let forwardFill: CanvasPattern | null = null
let backwardFill: CanvasPattern | null = null
if ('document' in window) {
  for (const direction of ['forward', 'backward']) {
    const canvas = document.createElement('canvas')
    const canvasSize = 10
    canvas.width = canvas.height = canvasSize
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const stripeColor1 = 'rgba(0,0,0,0)'
      const stripeColor2 = 'rgba(255,255,255,0.25)'
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
        forwardFill = ctx.createPattern(canvas, 'repeat')
      } else {
        backwardFill = ctx.createPattern(canvas, 'repeat')
      }
    }
  }
}

interface CanonicalGeneAnnotationFeature {
  parent?: AnnotationFeatureNew
  start?: number
  end?: number
  phase?: 0 | 1 | 2
  annotationFeature: AnnotationFeatureNew
}

interface CDSFeatures {
  parent: AnnotationFeatureNew
  cds: AnnotationFeatureNew
  cdsDiscontinuousLocs: CDSDiscontinuousLocation[]
}

interface ExonCDSRelation {
  exon: AnnotationFeatureNew
  cdsDL?: CDSDiscontinuousLocation
}

export class CanonicalGeneGlyph extends Glyph {
  /**
   * Return list of all the features (exons/cds) for each row for a given feature
   */
  featuresForRow(
    feature: AnnotationFeatureNew,
  ): CanonicalGeneAnnotationFeature[][] {
    const cdsFeatures: CDSFeatures[] = []
    for (const [, child] of feature.children ?? new Map()) {
      for (const [, annotationFeature] of child.children ?? new Map()) {
        if (annotationFeature.type === 'CDS') {
          const cdsDiscontinuousLocs = this.getDiscontinuousLocations(
            child,
            annotationFeature,
          )
          cdsFeatures.push({
            parent: child,
            cds: annotationFeature,
            cdsDiscontinuousLocs,
          })
        }
      }
    }

    // console.log('cdsFeatures', cdsFeatures)

    const features: CanonicalGeneAnnotationFeature[][] = []
    for (const f of cdsFeatures) {
      const childFeatures: CanonicalGeneAnnotationFeature[] = []
      for (const [, cf] of f.parent.children ?? new Map()) {
        if (cf.type === 'CDS' && cf._id !== f.cds._id) {
          continue
        }

        // Add all cds locations
        if (
          cf.type === 'CDS' &&
          f.cdsDiscontinuousLocs &&
          f.cdsDiscontinuousLocs.length > 0
        ) {
          for (const dl of f.cdsDiscontinuousLocs) {
            childFeatures.push({
              annotationFeature: cf,
              parent: f.parent,
              start: dl.start,
              end: dl.end,
              phase: dl.phase,
            })
          }
        } else {
          // Add all exons
          childFeatures.push({
            annotationFeature: cf,
            parent: f.parent,
          })
        }
      }
      // Add parent(mRNA) feature
      childFeatures.push({
        annotationFeature: f.parent,
      })
      features.push(childFeatures)
    }

    return features
  }

  getRowCount(feature: AnnotationFeatureNew, _bpPerPx?: number): number {
    let cdsCount = 0
    for (const [, child] of feature.children ?? new Map()) {
      for (const [, grandchild] of child.children ?? new Map()) {
        if (grandchild.type === 'CDS') {
          cdsCount += 1
        }
      }
    }
    return cdsCount
  }

  draw(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeatureNew,
    xOffset: number,
    row: number,
    reversed: boolean,
  ): void {
    const { apolloRowHeight, lgv, session, theme } = stateModel
    const { bpPerPx } = lgv
    const rowHeight = apolloRowHeight
    const exonHeight = Math.round(0.6 * rowHeight)
    const cdsHeight = Math.round(0.9 * rowHeight)
    const { _id, children, min, strand } = feature
    const { apolloSelectedFeature } = session

    // Draw lines on different rows for each mRNA
    let currentRow = 0
    for (const [, mrna] of children ?? new Map()) {
      if (mrna.type !== 'mRNA') {
        continue
      }
      for (const [, cds] of mrna.children ?? new Map()) {
        if (cds.type !== 'CDS') {
          continue
        }
        const offsetPx = (mrna.min - min) / bpPerPx
        const widthPx = mrna.length / bpPerPx
        const startPx = reversed
          ? xOffset - offsetPx - widthPx
          : xOffset + offsetPx
        const height =
          Math.round((currentRow + 1 / 2) * rowHeight) + row * rowHeight
        ctx.strokeStyle = theme?.palette.text.primary ?? 'black'
        ctx.beginPath()
        ctx.moveTo(startPx, height)
        ctx.lineTo(startPx + widthPx, height)
        ctx.stroke()
        currentRow += 1
      }
    }

    // Draw exon and CDS for each mRNA
    currentRow = 0
    for (const [, mrna] of children ?? new Map()) {
      if (mrna.type !== 'mRNA') {
        continue
      }
      for (const [, cds] of mrna.children ?? new Map()) {
        if (cds.type !== 'CDS') {
          continue
        }
        for (const [, exon] of mrna.children ?? new Map()) {
          if (exon.type !== 'exon') {
            continue
          }
          const offsetPx = (exon.min - min) / bpPerPx
          const widthPx = exon.length / bpPerPx
          const startPx = reversed
            ? xOffset - offsetPx - widthPx
            : xOffset + offsetPx
          const top = (row + currentRow) * rowHeight
          const exonTop = top + (rowHeight - exonHeight) / 2
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
          }

          // draw CDS
          if (exon.max < cds.min || exon.min > cds.max) {
            continue
          }

          const cdsMin =
            exon.min < cds.min && cds.min < exon.max ? cds.min : exon.min
          const cdsMax =
            exon.min < cds.max && cds.max < exon.max ? cds.max : exon.max
          const cdsOffsetPx = (cdsMin - min) / bpPerPx
          const cdsWidthPx = (cdsMax - cdsMin) / bpPerPx
          const cdsStartPx = reversed
            ? xOffset - cdsOffsetPx - cdsWidthPx
            : xOffset + cdsOffsetPx
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
            const frame = getFrame(cdsMin, cdsMax, cds.strand, cds.phase)
            const cdsColorCode = frameColors.at(frame) ?? 'rgb(171,71,188)'
            ctx.fillStyle =
              apolloSelectedFeature && cds._id === apolloSelectedFeature._id
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

    if (apolloSelectedFeature) {
      if (_id === apolloSelectedFeature._id) {
        const widthPx = feature.length / bpPerPx
        const startPx = reversed ? xOffset - widthPx : xOffset
        const top = row * rowHeight
        const height = this.getRowCount(feature) * rowHeight
        ctx.fillStyle = theme?.palette.action.selected ?? 'rgba(0,0,0,0.08)'
        ctx.fillRect(startPx, top, widthPx, height)
      } else {
        let featureEntry: AnnotationFeatureNew | undefined
        let featureRow: number | undefined
        let i = 0
        for (const [, f] of children ?? new Map()) {
          if (f._id === apolloSelectedFeature?._id) {
            featureEntry = f
            featureRow = i
          }
          i++
        }

        if (featureEntry === undefined || featureRow === undefined) {
          return
        }
        const cdsCount = this.cdsCount(featureEntry)
        let height = rowHeight
        if (cdsCount > 1) {
          height = height * cdsCount
        }
        const widthPx = featureEntry.length / bpPerPx
        const offsetPx = (featureEntry.min - min) / bpPerPx
        const startPx = reversed ? xOffset - widthPx : xOffset + offsetPx
        const top = (row + featureRow) * rowHeight
        ctx.fillStyle = theme?.palette.action.selected ?? 'rgba(0,0,0,08)'
        ctx.fillRect(startPx, top, widthPx, height)
      }
    }
  }

  // CDS count with discontinuous locations
  cdsCount(feature?: AnnotationFeatureNew) {
    let cdsCount = 0
    for (const [, cf] of feature?.children ?? new Map()) {
      if (
        cf.type === 'CDS' &&
        cf.discontinuousLocations &&
        cf.discontinuousLocations.length > 0
      ) {
        cdsCount++
      }
    }
    return cdsCount
  }

  drawHover(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    rowNum: number,
    xOffset: number,
    reversed: boolean,
  ) {
    const { apolloHover } = stateModel
    if (!apolloHover) {
      return
    }
    const { feature, topLevelFeature } = apolloHover
    if (!feature || !topLevelFeature) {
      return
    }

    if (feature.type === 'CDS') {
      const parentFeature = this.getParentFeature(feature, topLevelFeature)
      const cdsLocs = this.getDiscontinuousLocations(parentFeature, feature)
      for (const cdsLoc of cdsLocs) {
        this.drawShadeForFeature(
          stateModel,
          ctx,
          cdsLoc.start,
          cdsLoc.end,
          cdsLoc.end - cdsLoc.start,
        )
      }
    } else {
      this.drawShadeForFeature(
        stateModel,
        ctx,
        feature.min,
        feature.max,
        feature.length,
        rowNum,
        xOffset,
        reversed,
      )
    }
  }

  drawShadeForFeature(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    start: number,
    end: number,
    length: number,
    rowNum?: number,
    xOffset?: number,
    reversed?: boolean,
  ) {
    const { apolloHover, apolloRowHeight, displayedRegions, lgv, theme } =
      stateModel
    const { bpPerPx, bpToPx, offsetPx } = lgv

    if (!apolloHover) {
      return
    }
    const { feature, topLevelFeature } = apolloHover

    if (!feature || !topLevelFeature) {
      return
    }

    let featureEntry: AnnotationFeatureNew | undefined
    let childFeature: AnnotationFeatureNew | undefined
    let featureRow: number | undefined
    let i = 0
    for (const [, f] of topLevelFeature.children ?? new Map()) {
      if (f._id === feature._id) {
        featureEntry = f
        featureRow = i
      }
      for (const [, cf] of f.children ?? new Map()) {
        if (cf._id === feature._id) {
          childFeature = cf
          featureEntry = f
          featureRow = i
        }
      }
      i++
    }

    const cdsCount = this.cdsCount(featureEntry)

    if (cdsCount > 1 && rowNum && xOffset) {
      if (featureEntry === undefined || featureRow === undefined) {
        return
      }
      const widthPx = childFeature
        ? childFeature.length / bpPerPx
        : featureEntry.length / bpPerPx
      const offsetPx = childFeature
        ? (childFeature.min - feature.min) / bpPerPx
        : (featureEntry.min - feature.min) / bpPerPx
      const startPx = reversed ? xOffset - widthPx : xOffset + offsetPx
      const top = (rowNum + featureRow) * apolloRowHeight
      ctx.fillStyle = theme?.palette.action.selected ?? 'rgba(0,0,0,04)'
      ctx.fillRect(startPx, top, widthPx, apolloRowHeight * cdsCount)
    } else {
      const { mousePosition } = apolloHover
      if (!mousePosition) {
        return
      }
      const rowHeight = apolloRowHeight
      const { regionNumber, y } = mousePosition
      const rowNumber = Math.floor(y / rowHeight)

      const displayedRegion = displayedRegions[regionNumber]
      const { refName, reversed } = displayedRegion
      const startPx =
        (bpToPx({
          refName,
          coord: reversed ? end : start,
          regionNumber,
        })?.offsetPx ?? 0) - offsetPx
      const top = rowNumber * rowHeight
      const widthPx = length / bpPerPx
      ctx.fillStyle = theme?.palette.action.focus ?? 'rgba(0,0,0,0.04)'
      ctx.fillRect(startPx, top, widthPx, rowHeight)
    }
  }

  drawDragPreview(
    stateModel: LinearApolloDisplay,
    overlayCtx: CanvasRenderingContext2D,
  ) {
    const { apolloDragging, apolloRowHeight, displayedRegions, lgv, theme } =
      stateModel
    const { bpPerPx, offsetPx } = lgv
    if (!apolloDragging) {
      return
    }
    const {
      discontinuousLocation,
      feature,
      glyph,
      mousePosition: startingMousePosition,
    } = apolloDragging.start
    if (!feature) {
      throw new Error('no feature for drag preview??')
    }
    if (glyph !== this) {
      throw new Error('drawDragPreview() called on wrong glyph?')
    }
    const { mousePosition: currentMousePosition } = apolloDragging.current
    const edge = this.isMouseOnFeatureEdge(
      startingMousePosition,
      feature,
      stateModel,
    )
    if (!edge) {
      return
    }
    const row = Math.floor(startingMousePosition.y / apolloRowHeight)
    const region = displayedRegions[startingMousePosition.regionNumber]
    const rowCount = 1
    let featureEdgeBp
    if (discontinuousLocation) {
      const attr = edge === 'min' ? 'start' : 'end'
      featureEdgeBp = region.reversed
        ? region.end - discontinuousLocation[attr]
        : discontinuousLocation[attr] - region.start
    } else {
      featureEdgeBp = region.reversed
        ? region.end - feature[edge]
        : feature[edge] - region.start
    }
    const featureEdgePx = featureEdgeBp / bpPerPx - offsetPx
    const rectX = Math.min(currentMousePosition.x, featureEdgePx)
    const rectY = row * apolloRowHeight
    const rectWidth = Math.abs(currentMousePosition.x - featureEdgePx)
    const rectHeight = apolloRowHeight * rowCount
    overlayCtx.strokeStyle = theme?.palette.info.main ?? 'rgb(255,0,0)'
    overlayCtx.setLineDash([6])
    overlayCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
    overlayCtx.fillStyle = alpha(
      theme?.palette.info.main ?? 'rgb(255,0,0)',
      0.2,
    )
    overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight)
  }

  /**
   * Check If the mouse position is on the edge of the selected feature
   */
  isMouseOnFeatureEdge(
    mousePosition: MousePosition,
    feature: AnnotationFeatureNew,
    stateModel: LinearApolloDisplay,
    topLevelFeature?: AnnotationFeatureNew,
  ) {
    if (!mousePosition || !feature) {
      return
    }

    const { bp, refName, regionNumber, x } = mousePosition
    const { lgv } = stateModel
    const { bpToPx, offsetPx } = lgv
    const parentFeature = this.getParentFeature(feature, topLevelFeature)
    let startPxInfo
    let endPxInfo

    if (feature.type === 'CDS' && parentFeature) {
      let discontinuousLocation
      const cdsDiscontinuousLocs = this.getDiscontinuousLocations(
        parentFeature,
        feature,
      )
      for (const dl of cdsDiscontinuousLocs) {
        if (bp >= dl.start && bp <= dl.end) {
          discontinuousLocation = dl
          break
        }
      }
      if (!discontinuousLocation) {
        return
      }
      startPxInfo = bpToPx({
        refName,
        coord: discontinuousLocation.start,
        regionNumber,
      })
      endPxInfo = bpToPx({
        refName,
        coord: discontinuousLocation.end,
        regionNumber,
      })
    } else {
      startPxInfo = bpToPx({
        refName,
        coord: feature.min,
        regionNumber,
      })
      endPxInfo = bpToPx({ refName, coord: feature.max, regionNumber })
    }

    if (startPxInfo !== undefined && endPxInfo !== undefined) {
      const startPx = startPxInfo.offsetPx - offsetPx
      const endPx = endPxInfo.offsetPx - offsetPx
      if (Math.abs(endPx - startPx) < 8) {
        return
      }
      // Limit dragging till parent feature end
      if (parentFeature) {
        if (parentFeature.type === 'gene') {
          return
        }
        if (feature.min <= parentFeature.min && Math.abs(startPx - x) < 4) {
          return
        }
        if (feature.max >= parentFeature.max && Math.abs(endPx - x) < 4) {
          return
        }
      }
      if (Math.abs(startPx - x) < 4) {
        return 'min'
      }
      if (Math.abs(endPx - x) < 4) {
        return 'max'
      }
    }
    return
  }

  onMouseMove(stateModel: LinearApolloDisplay, event: CanvasMouseEvent) {
    const { feature, mousePosition, topLevelFeature } =
      stateModel.getFeatureAndGlyphUnderMouse(event)
    if (stateModel.apolloDragging) {
      stateModel.setCursor('col-resize')
      return
    }
    if (feature && mousePosition) {
      const edge = this.isMouseOnFeatureEdge(
        mousePosition,
        feature,
        stateModel,
        topLevelFeature,
      )
      if (edge) {
        stateModel.setCursor('col-resize')
      } else {
        stateModel.setCursor()
      }
    }
  }

  onMouseDown(stateModel: LinearApolloDisplay, event: CanvasMouseEvent) {
    // swallow the mouseDown if we are on the edge of the feature
    const { feature, mousePosition } =
      stateModel.getFeatureAndGlyphUnderMouse(event)
    if (feature && mousePosition) {
      const edge = this.isMouseOnFeatureEdge(mousePosition, feature, stateModel)
      if (edge) {
        event.stopPropagation()
      }
    }
  }

  onMouseUp(stateModel: LinearApolloDisplay, event: CanvasMouseEvent) {
    if (stateModel.apolloDragging ?? event.button !== 0) {
      return
    }
    const { feature } = stateModel.getFeatureAndGlyphUnderMouse(event)
    if (feature) {
      stateModel.setSelectedFeature(feature)
    }
  }

  startDrag(stateModel: LinearApolloDisplay): boolean {
    // only accept the drag if we are on the edge of the feature
    const { feature, mousePosition, topLevelFeature } =
      stateModel.apolloDragging?.start ?? {}
    const { mousePosition: currentMousePosition } =
      stateModel.apolloDragging?.current ?? {}
    if (feature && mousePosition && currentMousePosition) {
      const edge = this.isMouseOnFeatureEdge(
        mousePosition,
        feature,
        stateModel,
        topLevelFeature,
      )
      if (edge) {
        return true
      }
    }
    return false
  }

  adjacentExonsOfCdsDL(
    cdsDL: CDSDiscontinuousLocation,
    exonCDSRelations: ExonCDSRelation[],
  ) {
    let prevExon, nextExon, matchingExon, idx
    if (exonCDSRelations) {
      for (const [i, exonCDSRelation] of exonCDSRelations.entries()) {
        const dl = exonCDSRelation.cdsDL
        if (
          cdsDL.start === dl?.start &&
          cdsDL.end === dl.end &&
          cdsDL.phase === dl.phase
        ) {
          idx = i
          break
        }
      }
      if (idx !== undefined) {
        const { exon } = exonCDSRelations[idx]
        matchingExon = exon
      }
      if (idx !== undefined && idx > 0) {
        prevExon = exonCDSRelations[idx - 1].exon
      }
      if (idx !== undefined && idx < exonCDSRelations.length - 1) {
        nextExon = exonCDSRelations[idx + 1].exon
      }
    }
    return { prevExon, matchingExon, nextExon }
  }

  exonCDSRelation(
    cds?: AnnotationFeatureNew,
    topLevelFeature?: AnnotationFeatureNew,
  ): ExonCDSRelation[] {
    const exonCDSRelations: ExonCDSRelation[] = []
    if (!cds) {
      return exonCDSRelations
    }
    const parentFeature = this.getParentFeature(cds, topLevelFeature)
    if (!parentFeature?.children) {
      return exonCDSRelations
    }
    for (const [, f] of parentFeature.children) {
      if (f.type === 'exon') {
        const cdsDLForExon = this.cdsDLForExon(f, cds, parentFeature)
        exonCDSRelations.push({
          exon: f,
          cdsDL: cdsDLForExon
            ? {
                start: cdsDLForExon.start,
                end: cdsDLForExon.end,
                phase: cdsDLForExon.phase,
              }
            : undefined,
        })
      }
    }
    return exonCDSRelations
  }

  cdsDLForExon(
    exon: AnnotationFeatureNew,
    cds: AnnotationFeatureNew,
    parentFeature: AnnotationFeatureNew,
  ) {
    let discontinuousLocation
    const cdsLocs = this.getDiscontinuousLocations(parentFeature, cds)
    for (const dl of cdsLocs) {
      if (dl.start >= exon.min && dl.end <= exon.max) {
        discontinuousLocation = dl
        break
      }
    }
    return discontinuousLocation
  }

  cdsDlsForExon(
    exon: AnnotationFeatureNew,
    topLevelFeature?: AnnotationFeatureNew,
  ): CDSDiscontinuousLocation[] {
    const dls: CDSDiscontinuousLocation[] = []
    const parentFeature = this.getParentFeature(exon, topLevelFeature)
    if (!parentFeature?.children || !topLevelFeature) {
      return dls
    }
    const cdsFeatures: AnnotationFeatureNew[] = []
    for (const [, f] of parentFeature.children) {
      if (f.type === 'CDS') {
        cdsFeatures.push(f)
      }
    }

    for (const cds of cdsFeatures) {
      for (const [, f] of parentFeature.children) {
        if (f.type === 'exon' && f._id === exon._id) {
          const cdsDLForExon = this.cdsDLForExon(f, cds, parentFeature)
          if (cdsDLForExon) {
            dls.push(cdsDLForExon)
          }
        }
      }
    }
    return dls
  }

  adjacentExonsOfExon(
    exon: AnnotationFeatureNew,
    topLevelFeature?: AnnotationFeatureNew,
  ) {
    const parentFeature: AnnotationFeatureNew = this.getParentFeature(
      exon,
      topLevelFeature,
    )
    if (!(parentFeature && parentFeature.children)) {
      return
    }

    let i = 0
    for (const [, f] of parentFeature.children) {
      if (f._id === exon._id) {
        break
      }
      i++
    }

    let prevExon, nextExon
    const keys = [...parentFeature.children.keys()]
    if (i > 0) {
      const f = parentFeature.children.get(keys[i - 1])
      if (f && f.type === 'exon') {
        prevExon = f
      }
    }
    if (i < keys.length - 1) {
      const f = parentFeature.children.get(keys[i + 1])
      if (f && f.type === 'exon') {
        nextExon = f
      }
    }
    return { prevExon, nextExon }
  }

  continueDrag(
    stateModel: LinearApolloDisplay,
    currentMousePosition: MousePosition,
  ): void {
    const {
      discontinuousLocation,
      feature,
      glyph,
      mousePosition,
      topLevelFeature,
    } = stateModel.apolloDragging?.start ?? {}
    if (!(currentMousePosition && mousePosition)) {
      return
    }
    const { bp } = currentMousePosition
    if (!feature || !currentMousePosition) {
      return
    }
    const edge = this.isMouseOnFeatureEdge(
      mousePosition,
      feature,
      stateModel,
      topLevelFeature,
    )
    if (feature.type === 'CDS' && discontinuousLocation) {
      const exonCDSRelations = this.exonCDSRelation(feature, topLevelFeature)
      const { matchingExon, nextExon, prevExon } = this.adjacentExonsOfCdsDL(
        discontinuousLocation,
        exonCDSRelations,
      )
      // if (nextExon && bp >= nextExon.min - 1) {
      //   return
      // }
      // if (prevExon && bp <= prevExon.max + 1) {
      //   return
      // }
      // if (!prevExon && nextExon && matchingExon && bp < matchingExon.min) {
      //   return
      // }
      // if (prevExon && !nextExon && matchingExon && bp > matchingExon.max) {
      //   return
      // }
      if (matchingExon && bp < matchingExon.min) {
        return
      }
      if (matchingExon && bp > matchingExon.max) {
        return
      }
      if (
        edge &&
        ((edge === 'min' && bp >= discontinuousLocation.end - 1) ||
          (edge === 'max' && bp <= discontinuousLocation.start + 1))
      ) {
        return
      }
    }
    if (feature.type !== 'CDS') {
      const adjacentExons = this.adjacentExonsOfExon(feature, topLevelFeature)
      if (adjacentExons?.nextExon && bp >= adjacentExons?.nextExon.min - 1) {
        return
      }
      if (adjacentExons?.prevExon && bp <= adjacentExons?.prevExon.max + 1) {
        return
      }
      const dls: CDSDiscontinuousLocation[] = this.cdsDlsForExon(
        feature,
        topLevelFeature,
      )
      if (dls && dls.length > 0) {
        let stopDrag
        for (const dl of dls) {
          if (
            edge &&
            ((edge === 'min' && bp >= dl.start - 1) ||
              (edge === 'max' && bp <= dl.end + 1))
          ) {
            stopDrag = true
            break
          }
        }
        if (stopDrag) {
          return
        }
      } else {
        if (
          edge &&
          ((edge === 'min' && bp >= feature.max - 1) ||
            (edge === 'max' && bp <= feature.min + 1))
        ) {
          return
        }
      }
    }
    stateModel.setDragging({
      start: {
        feature,
        topLevelFeature,
        glyph,
        discontinuousLocation,
        mousePosition,
      },
      current: {
        feature,
        topLevelFeature,
        glyph,
        mousePosition: currentMousePosition,
      },
    })
  }

  getFeatureFromLayout(
    feature: AnnotationFeatureNew,
    bp: number,
    row: number,
  ): AnnotationFeatureNew | undefined {
    const featuresForRow: CanonicalGeneAnnotationFeature[] =
      this.featuresForRow(feature)[row]
    let featureFromLayout: AnnotationFeatureNew | undefined

    for (const f of featuresForRow) {
      if (
        f.start !== undefined &&
        f.end !== undefined &&
        f.phase !== undefined
      ) {
        if (bp >= f.start && bp <= f.end && f.parent) {
          featureFromLayout = f.annotationFeature
        }
      } else {
        if (
          bp >= f.annotationFeature.min &&
          bp <= f.annotationFeature.max &&
          f.parent
        ) {
          featureFromLayout = f.annotationFeature
        }
      }
    }

    if (!featureFromLayout) {
      featureFromLayout = featuresForRow.at(-1)?.annotationFeature
    }

    return featureFromLayout
  }

  getRowForFeature(
    feature: AnnotationFeatureNew,
    childFeature: AnnotationFeatureNew,
  ) {
    const rows = this.featuresForRow(feature)
    for (const [idx, row] of rows.entries()) {
      if (
        row.some(
          (feature) => feature.annotationFeature._id === childFeature._id,
        )
      ) {
        return idx
      }
    }
    return
  }

  async executeDrag(stateModel: LinearApolloDisplay) {
    const {
      apolloDragging,
      changeManager,
      displayedRegions,
      getAssemblyId,
      setCursor,
    } = stateModel
    if (!apolloDragging) {
      return
    }
    const {
      discontinuousLocation,
      feature,
      glyph,
      mousePosition: startingMousePosition,
      topLevelFeature,
    } = apolloDragging.start
    if (!feature) {
      throw new Error('no feature for drag preview??')
    }
    if (glyph !== this) {
      throw new Error('drawDragPreview() called on wrong glyph?')
    }
    const edge = this.isMouseOnFeatureEdge(
      startingMousePosition,
      feature,
      stateModel,
    )
    if (!edge) {
      return
    }

    const { mousePosition: currentMousePosition } = apolloDragging.current
    const region = displayedRegions[startingMousePosition.regionNumber]
    const newBp = currentMousePosition.bp
    const assembly = getAssemblyId(region.assemblyName)
    const changes: (
      | LocationStartChange
      | LocationEndChange
      | DiscontinuousLocationEndChange
      | DiscontinuousLocationStartChange
    )[] = []

    const parentFeature = glyph.getParentFeature(feature, topLevelFeature)
    const cdsLocs = glyph.getDiscontinuousLocations(parentFeature, feature)

    if (edge === 'min') {
      if (
        discontinuousLocation?.idx !== undefined &&
        cdsLocs &&
        cdsLocs.length > 0
      ) {
        const oldStart = cdsLocs[discontinuousLocation.idx].start
        // this.addDiscontinuousLocStartChange(
        //   changes,
        //   feature,
        //   newBp,
        //   oldStart,
        //   assembly,
        //   discontinuousLocation.idx,
        // )
        feature.setMin(newBp)

        const exonCDSRelations = this.exonCDSRelation(feature, topLevelFeature)
        const exonForCds = this.adjacentExonsOfCdsDL(
          discontinuousLocation,
          exonCDSRelations,
        )
        if (
          exonForCds &&
          exonForCds.matchingExon &&
          newBp < exonForCds.matchingExon.min
        ) {
          // this.addStartLocationChange(
          //   changes,
          //   exonForCds.matchingExon,
          //   newBp,
          //   assembly,
          // )
          exonForCds.matchingExon.setMin(newBp)
        }
      } else {
        // this.addStartLocationChange(changes, feature, newBp, assembly)
        feature.setMin(newBp)
      }
    } else {
      if (
        discontinuousLocation?.idx !== undefined &&
        cdsLocs &&
        cdsLocs.length > 0
      ) {
        const oldEnd = cdsLocs[discontinuousLocation.idx].end
        // this.addDiscontinuousLocEndChange(
        //   changes,
        //   feature,
        //   newBp,
        //   oldEnd,
        //   assembly,
        //   discontinuousLocation.idx,
        // )
        feature.setMax(newBp)

        const exonCDSRelations = this.exonCDSRelation(feature, topLevelFeature)
        const exonForCds = this.adjacentExonsOfCdsDL(
          discontinuousLocation,
          exonCDSRelations,
        )
        if (
          exonForCds &&
          exonForCds.matchingExon &&
          newBp > exonForCds.matchingExon.max
        ) {
          // this.addEndLocationChange(
          //   changes,
          //   exonForCds.matchingExon,
          //   newBp,
          //   assembly,
          // )
          exonForCds.matchingExon.setMax(newBp)
        }
      } else {
        // this.addEndLocationChange(changes, feature, newBp, assembly)
        feature.setMax(newBp)
      }
    }

    if (!changeManager) {
      throw new Error('no change manager')
    }
    // for (const change of changes) {
    //   await changeManager.submit(change)
    // }

    setCursor()
  }

  addDiscontinuousLocStartChange(
    changes: LocationChange[],
    feature: AnnotationFeatureNew, // cds
    newBp: number,
    oldStart: number,
    assembly: string,
    index: number,
  ) {
    const featureId = feature._id
    changes.push(
      new DiscontinuousLocationStartChange({
        typeName: 'DiscontinuousLocationStartChange',
        changedIds: [feature._id],
        featureId,
        newStart: newBp,
        oldStart,
        index,
        assembly,
      }),
    )
  }

  addStartLocationChange(
    changes: LocationChange[],
    feature: AnnotationFeatureNew,
    newBp: number,
    assembly: string,
  ) {
    const featureId = feature._id
    const oldStart = feature.min
    const newStart = newBp
    changes.push(
      new LocationStartChange({
        typeName: 'LocationStartChange',
        changedIds: [featureId],
        featureId,
        oldStart,
        newStart,
        assembly,
      }),
    )
  }

  addDiscontinuousLocEndChange(
    changes: LocationChange[],
    feature: AnnotationFeatureNew, // cds
    newBp: number,
    oldEnd: number,
    assembly: string,
    index: number,
  ) {
    const featureId = feature._id
    changes.push(
      new DiscontinuousLocationEndChange({
        typeName: 'DiscontinuousLocationEndChange',
        changedIds: [feature._id],
        featureId,
        newEnd: newBp,
        oldEnd,
        index,
        assembly,
      }),
    )
  }

  addEndLocationChange(
    changes: LocationChange[],
    feature: AnnotationFeatureNew,
    newBp: number,
    assembly: string,
  ) {
    const featureId = feature._id
    const oldEnd = feature.max
    const newEnd = newBp
    changes.push(
      new LocationEndChange({
        typeName: 'LocationEndChange',
        changedIds: [featureId],
        featureId,
        oldEnd,
        newEnd,
        assembly,
      }),
    )
  }
}
