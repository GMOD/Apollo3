import { alpha } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import {
  DiscontinuousLocationChange,
  LocationEndChange,
  LocationStartChange,
} from 'apollo-shared'

import { LinearApolloDisplay } from '../stateModel'
import {
  CDSDiscontinuousLocation,
  MousePosition,
} from '../stateModel/mouseEvents'
import { CanvasMouseEvent } from '../types'
import { Glyph } from './Glyph'

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

interface AnnotationFeature {
  parent?: AnnotationFeatureI
  start?: number
  end?: number
  phase?: 0 | 1 | 2
  annotationFeature: AnnotationFeatureI
}

interface CDSFeatures {
  parent: AnnotationFeatureI
  cds: AnnotationFeatureI
}

interface ExonCDSRelation {
  exon: AnnotationFeatureI
  cdsDL?: CDSDiscontinuousLocation
}

export class CanonicalGeneGlyph extends Glyph {
  featuresForRow(feature: AnnotationFeatureI): AnnotationFeature[][] {
    const cdsFeatures: CDSFeatures[] = []
    for (const [, child] of feature.children ?? new Map()) {
      for (const [, annotationFeature] of child.children ?? new Map()) {
        if (annotationFeature.type === 'CDS') {
          cdsFeatures.push({
            parent: child,
            cds: annotationFeature,
          })
        }
      }
    }

    const features: AnnotationFeature[][] = []
    for (const f of cdsFeatures) {
      const childFeatures: AnnotationFeature[] = []
      for (const [, cf] of f.parent.children ?? new Map()) {
        if (cf.type === 'CDS' && cf._id !== f.cds._id) {
          continue
        }
        if (cf.discontinuousLocations && cf.discontinuousLocations.length > 0) {
          for (const dl of cf.discontinuousLocations) {
            childFeatures.push({
              annotationFeature: cf,
              parent: f.parent,
              start: dl.start,
              end: dl.end,
              phase: dl.phase,
            })
          }
        } else {
          childFeatures.push({
            annotationFeature: cf,
            parent: f.parent,
          })
        }
      }
      childFeatures.push({
        annotationFeature: f.parent,
      })
      features.push(childFeatures)
    }

    return features
  }

  getRowCount(feature: AnnotationFeatureI, _bpPerPx?: number): number {
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
    feature: AnnotationFeatureI,
    xOffset: number,
    row: number,
    reversed: boolean,
  ): void {
    const { apolloRowHeight, lgv, session, theme } = stateModel
    const { bpPerPx } = lgv
    const rowHeight = apolloRowHeight
    const utrHeight = Math.round(0.6 * rowHeight)
    const cdsHeight = Math.round(0.9 * rowHeight)
    const { _id, children, min, strand } = feature
    const { apolloSelectedFeature } = session
    let currentCDS = 0
    for (const [, mrna] of children ?? new Map()) {
      if (mrna.type !== 'mRNA') {
        continue
      }
      for (const [, cds] of mrna.children ?? new Map()) {
        if (cds.type !== 'CDS') {
          continue
        }
        const offsetPx = (mrna.start - min) / bpPerPx
        const widthPx = mrna.length / bpPerPx
        const startPx = reversed
          ? xOffset - offsetPx - widthPx
          : xOffset + offsetPx
        const height =
          Math.round((currentCDS + 1 / 2) * rowHeight) + row * rowHeight
        ctx.strokeStyle = theme?.palette.text.primary ?? 'black'
        ctx.beginPath()
        ctx.moveTo(startPx, height)
        ctx.lineTo(startPx + widthPx, height)
        ctx.stroke()
        currentCDS += 1
      }
    }
    currentCDS = 0
    for (const [, mrna] of children ?? new Map()) {
      if (mrna.type !== 'mRNA') {
        continue
      }
      const cdsCount = [...(mrna.children ?? [])].filter(
        ([, exonOrCDS]) => exonOrCDS.type === 'CDS',
      ).length
      for (let count = 0; count < cdsCount; count++) {
        for (const [, exon] of mrna.children ?? new Map()) {
          if (exon.type !== 'exon') {
            continue
          }
          const offsetPx = (exon.start - min) / bpPerPx
          const widthPx = exon.length / bpPerPx
          const startPx = reversed
            ? xOffset - offsetPx - widthPx
            : xOffset + offsetPx
          const top = (row + currentCDS) * rowHeight
          const utrTop = top + (rowHeight - utrHeight) / 2
          ctx.fillStyle = theme?.palette.text.primary ?? 'black'
          ctx.fillRect(startPx, utrTop, widthPx, utrHeight)
          if (widthPx > 2) {
            ctx.clearRect(startPx + 1, utrTop + 1, widthPx - 2, utrHeight - 2)
            ctx.fillStyle =
              apolloSelectedFeature && exon._id === apolloSelectedFeature._id
                ? 'rgb(0,0,0)'
                : 'rgb(211,211,211)'
            ctx.fillRect(startPx + 1, utrTop + 1, widthPx - 2, utrHeight - 2)
            if (forwardFill && backwardFill && strand) {
              const reversal = reversed ? -1 : 1
              const [topFill, bottomFill] =
                strand * reversal === 1
                  ? [forwardFill, backwardFill]
                  : [backwardFill, forwardFill]
              ctx.fillStyle = topFill
              ctx.fillRect(
                startPx + 1,
                utrTop + 1,
                widthPx - 2,
                (utrHeight - 2) / 2,
              )
              ctx.fillStyle = bottomFill
              ctx.fillRect(
                startPx + 1,
                utrTop + 1 + (utrHeight - 2) / 2,
                widthPx - 2,
                (utrHeight - 2) / 2,
              )
            }
          }
        }
        currentCDS += 1
      }
    }
    currentCDS = 0
    for (const [, mrna] of children ?? new Map()) {
      if (mrna.type !== 'mRNA') {
        continue
      }
      for (const [, cds] of mrna.children ?? new Map()) {
        if (cds.type !== 'CDS') {
          continue
        }
        if (cds.discontinuousLocations) {
          for (const cdsLocation of cds.discontinuousLocations) {
            const offsetPx = (cdsLocation.start - min) / bpPerPx
            const widthPx = (cdsLocation.end - cdsLocation.start) / bpPerPx
            const startPx = reversed
              ? xOffset - offsetPx - widthPx
              : xOffset + offsetPx
            ctx.fillStyle = theme?.palette.text.primary ?? 'black'
            const top = (row + currentCDS) * rowHeight
            const cdsTop = top + (rowHeight - cdsHeight) / 2
            ctx.fillRect(startPx, cdsTop, widthPx, cdsHeight)
            if (widthPx > 2) {
              ctx.clearRect(startPx + 1, cdsTop + 1, widthPx - 2, cdsHeight - 2)
              ctx.fillStyle =
                apolloSelectedFeature && cds._id === apolloSelectedFeature._id
                  ? 'rgb(0,0,0)'
                  : 'rgb(255,165,0)'
              ctx.fillRect(startPx + 1, cdsTop + 1, widthPx - 2, cdsHeight - 2)
              if (forwardFill && backwardFill && strand) {
                const reversal = reversed ? -1 : 1
                const [topFill, bottomFill] =
                  strand * reversal === 1
                    ? [forwardFill, backwardFill]
                    : [backwardFill, forwardFill]
                ctx.fillStyle = topFill
                ctx.fillRect(
                  startPx + 1,
                  cdsTop + 1,
                  widthPx - 2,
                  (cdsHeight - 2) / 2,
                )
                ctx.fillStyle = bottomFill
                ctx.fillRect(
                  startPx + 1,
                  cdsTop + (cdsHeight - 2) / 2,
                  widthPx - 2,
                  (cdsHeight - 2) / 2,
                )
              }
            }
          }
        }
        currentCDS += 1
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
        let featureEntry: AnnotationFeatureI | undefined
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
        const offsetPx = (featureEntry.start - min) / bpPerPx
        const startPx = reversed ? xOffset - widthPx : xOffset + offsetPx
        const top = (row + featureRow) * rowHeight
        ctx.fillStyle = theme?.palette.action.selected ?? 'rgba(0,0,0,08)'
        ctx.fillRect(startPx, top, widthPx, height)
      }
    }
  }

  // CDS count with discontinuous locations
  cdsCount(feature?: AnnotationFeatureI) {
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
    const { feature } = apolloHover
    if (!feature) {
      return
    }

    if (
      feature.discontinuousLocations &&
      feature.discontinuousLocations.length > 0
    ) {
      for (const dl of feature.discontinuousLocations) {
        this.drawShadeForFeature(
          stateModel,
          ctx,
          dl.start,
          dl.end,
          dl.end - dl.start,
        )
      }
    } else {
      this.drawShadeForFeature(
        stateModel,
        ctx,
        feature.start,
        feature.end,
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

    let featureEntry: AnnotationFeatureI | undefined
    let childFeature: AnnotationFeatureI | undefined
    let featureRow: number | undefined
    let i = 0
    for (const [, f] of topLevelFeature.children ?? new Map()) {
      if (f._id === feature?._id) {
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
        ? (childFeature.start - feature.min) / bpPerPx
        : (featureEntry.start - feature.min) / bpPerPx
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
      featureEdgeBp = region.reversed
        ? region.end - discontinuousLocation[edge]
        : discontinuousLocation[edge] - region.start
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
    feature: AnnotationFeatureI,
    stateModel: LinearApolloDisplay,
    topLevelFeature?: AnnotationFeatureI,
  ) {
    if (!mousePosition) {
      return
    }

    const { bp, refName, regionNumber, x } = mousePosition
    const { lgv } = stateModel
    const { bpToPx, offsetPx } = lgv
    let startPxInfo
    let endPxInfo
    if (
      feature.discontinuousLocations &&
      feature.discontinuousLocations.length > 0
    ) {
      let discontinuousLocation
      for (const dl of feature.discontinuousLocations) {
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
        coord: feature.start,
        regionNumber,
      })
      endPxInfo = bpToPx({ refName, coord: feature.end, regionNumber })
    }

    if (startPxInfo !== undefined && endPxInfo !== undefined) {
      const startPx = startPxInfo.offsetPx - offsetPx
      const endPx = endPxInfo.offsetPx - offsetPx
      if (Math.abs(endPx - startPx) < 8) {
        return
      }
      const parentFeature = this.getParentFeature(feature, topLevelFeature)
      // Limit dragging till parent feature end
      if (parentFeature) {
        if (parentFeature.type === 'gene') {
          return
        }
        if (feature.start <= parentFeature.start && Math.abs(startPx - x) < 4) {
          return
        }
        if (feature.end >= parentFeature.end && Math.abs(endPx - x) < 4) {
          return
        }
      }
      if (Math.abs(startPx - x) < 4) {
        return 'start'
      }
      if (Math.abs(endPx - x) < 4) {
        return 'end'
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
    cds?: AnnotationFeatureI,
    topLevelFeature?: AnnotationFeatureI,
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
        const cdsDLForExon = this.cdsDLForExon(f, cds)
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

  cdsDLForExon(exon: AnnotationFeatureI, cds: AnnotationFeatureI) {
    let discontinuousLocation
    if (cds.discontinuousLocations && cds.discontinuousLocations.length > 0) {
      for (const dl of cds.discontinuousLocations) {
        if (dl.start >= exon.start && dl.end <= exon.end) {
          discontinuousLocation = dl
          break
        }
      }
    }
    return discontinuousLocation
  }

  cdsDlsForExon(
    exon: AnnotationFeatureI,
    topLevelFeature?: AnnotationFeatureI,
  ): CDSDiscontinuousLocation[] {
    const dls: CDSDiscontinuousLocation[] = []
    const parentFeature = this.getParentFeature(exon, topLevelFeature)
    if (!parentFeature?.children || !topLevelFeature) {
      return dls
    }
    const cdsFeatures: AnnotationFeatureI[] = []
    for (const [, f] of parentFeature.children) {
      if (f.type === 'CDS') {
        cdsFeatures.push(f)
      }
    }

    for (const cds of cdsFeatures) {
      for (const [, f] of parentFeature.children) {
        if (f.type === 'exon' && f._id === exon._id) {
          const cdsDLForExon = this.cdsDLForExon(f, cds)
          if (cdsDLForExon) {
            dls.push(cdsDLForExon)
          }
        }
      }
    }
    return dls
  }

  adjacentExonsOfExon(
    exon: AnnotationFeatureI,
    topLevelFeature?: AnnotationFeatureI,
  ) {
    const parentFeature: AnnotationFeatureI = this.getParentFeature(
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

    if (
      feature.type === 'CDS' &&
      feature.discontinuousLocations &&
      feature.discontinuousLocations.length > 0 &&
      discontinuousLocation
    ) {
      const exonCDSRelations = this.exonCDSRelation(feature, topLevelFeature)
      const { matchingExon, nextExon, prevExon } = this.adjacentExonsOfCdsDL(
        discontinuousLocation,
        exonCDSRelations,
      )

      if (nextExon && bp >= nextExon.start - 1) {
        return
      }
      if (prevExon && bp <= prevExon.end + 1) {
        return
      }
      if (!prevExon && nextExon && matchingExon && bp < matchingExon.start) {
        return
      }
      if (prevExon && !nextExon && matchingExon && bp > matchingExon.end) {
        return
      }

      if (
        edge &&
        ((edge === 'start' && bp >= discontinuousLocation.end - 1) ||
          (edge === 'end' && bp <= discontinuousLocation.start + 1))
      ) {
        return
      }
    }

    if (feature.type !== 'CDS') {
      const adjacentExons = this.adjacentExonsOfExon(feature, topLevelFeature)
      if (adjacentExons?.nextExon && bp >= adjacentExons?.nextExon.start - 1) {
        return
      }
      if (adjacentExons?.prevExon && bp <= adjacentExons?.prevExon.end + 1) {
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
            ((edge === 'start' && bp >= dl.start - 1) ||
              (edge === 'end' && bp <= dl.end + 1))
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
          ((edge === 'start' && bp >= feature.end - 1) ||
            (edge === 'end' && bp <= feature.start + 1))
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
    feature: AnnotationFeatureI,
    bp: number,
    row: number,
  ): AnnotationFeatureI | undefined {
    const featuresForRow: AnnotationFeature[] =
      this.featuresForRow(feature)[row]
    let featureFromLayout: AnnotationFeatureI | undefined

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
          bp >= f.annotationFeature.start &&
          bp <= f.annotationFeature.end &&
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
      | DiscontinuousLocationChange
    )[] = []

    if (edge === 'start') {
      if (
        discontinuousLocation?.idx !== undefined &&
        feature.discontinuousLocations &&
        feature.discontinuousLocations.length > 0
      ) {
        this.addDiscontinuousLocStartChange(
          changes,
          feature,
          newBp,
          assembly,
          discontinuousLocation?.idx,
        )

        const exonCDSRelations = this.exonCDSRelation(feature, topLevelFeature)
        const exonForCds = this.adjacentExonsOfCdsDL(
          discontinuousLocation,
          exonCDSRelations,
        )
        if (
          exonForCds &&
          exonForCds.matchingExon &&
          newBp < exonForCds.matchingExon.start
        ) {
          this.addStartLocationChange(
            changes,
            exonForCds.matchingExon,
            newBp,
            assembly,
          )
        }
      } else {
        this.addStartLocationChange(changes, feature, newBp, assembly)
      }
    } else {
      if (
        discontinuousLocation?.idx !== undefined &&
        feature.discontinuousLocations &&
        feature.discontinuousLocations.length > 0
      ) {
        this.addDiscontinuousLocEndChange(
          changes,
          feature,
          newBp,
          assembly,
          discontinuousLocation?.idx,
        )

        const exonCDSRelations = this.exonCDSRelation(feature, topLevelFeature)
        const exonForCds = this.adjacentExonsOfCdsDL(
          discontinuousLocation,
          exonCDSRelations,
        )
        if (
          exonForCds &&
          exonForCds.matchingExon &&
          newBp > exonForCds.matchingExon.end
        ) {
          this.addEndLocationChange(
            changes,
            exonForCds.matchingExon,
            newBp,
            assembly,
          )
        }
      } else {
        this.addEndLocationChange(changes, feature, newBp, assembly)
      }
    }

    if (!changeManager) {
      throw new Error('no change manager')
    }
    for (const change of changes) {
      await changeManager.submit(change)
    }

    setCursor()
  }

  addDiscontinuousLocStartChange(
    changes: (
      | LocationStartChange
      | LocationEndChange
      | DiscontinuousLocationChange
    )[],
    feature: AnnotationFeatureI, // cds
    newBp: number,
    assembly: string,
    index: number,
  ) {
    const featureId = feature._id
    changes.push(
      new DiscontinuousLocationChange({
        typeName: 'DiscontinuousLocationChange',
        changedIds: [feature._id],
        featureId,
        start: { newStart: newBp, index },
        assembly,
      }),
    )
  }

  addDiscontinuousLocEndChange(
    changes: (
      | LocationStartChange
      | LocationEndChange
      | DiscontinuousLocationChange
    )[],
    feature: AnnotationFeatureI, // cds
    newBp: number,
    assembly: string,
    index: number,
  ) {
    const featureId = feature._id
    changes.push(
      new DiscontinuousLocationChange({
        typeName: 'DiscontinuousLocationChange',
        changedIds: [feature._id],
        featureId,
        end: { newEnd: newBp, index },
        assembly,
      }),
    )
  }

  addEndLocationChange(
    changes: (
      | LocationStartChange
      | LocationEndChange
      | DiscontinuousLocationChange
    )[],
    feature: AnnotationFeatureI,
    newBp: number,
    assembly: string,
  ) {
    const featureId = feature._id
    const oldEnd = feature.end
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

  addStartLocationChange(
    changes: (
      | LocationStartChange
      | LocationEndChange
      | DiscontinuousLocationChange
    )[],
    feature: AnnotationFeatureI,
    newBp: number,
    assembly: string,
  ) {
    const featureId = feature._id
    const oldStart = feature.start
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
}
