import { AnnotationFeature } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import { getFrame } from '@jbrowse/core/util'
import { alpha } from '@mui/material'

import { LinearApolloDisplay } from '../stateModel'
import { MousePosition } from '../stateModel/mouseEvents'
import { CanvasMouseEvent } from '../types'
import { Glyph } from './Glyph'
import { boxGlyph } from './BoxGlyph'

type LocationChange = LocationEndChange | LocationStartChange

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

export class GeneGlyph implements Glyph {
  /**
   * A list of all the subfeatures for each row for a given feature, as well as
   * the feature itself.
   * If the row contains an mRNA, the order is CDS -\> exon -\> mRNA -\> gene
   * If the row does not contain an mRNA, the order is subfeature -\> gene
   */
  featuresForRow(feature: AnnotationFeature): AnnotationFeature[][] {
    if (feature.type !== 'gene') {
      throw new Error('Top level feature for GeneGlyph must have type "gene"')
    }
    const { children } = feature
    if (!children) {
      return [[feature]]
    }
    const features: AnnotationFeature[][] = []
    for (const [, child] of children) {
      if (child.type !== 'mRNA') {
        features.push([child, feature])
        continue
      }
      if (!child.children) {
        continue
      }
      const cdss: AnnotationFeature[] = []
      const exons: AnnotationFeature[] = []
      for (const [, grandchild] of child.children) {
        if (grandchild.type === 'CDS') {
          cdss.push(grandchild)
        } else if (grandchild.type === 'exon') {
          exons.push(grandchild)
        }
      }
      for (const cds of cdss) {
        features.push([cds, ...exons, child, feature])
      }
    }
    return features
  }

  getRowCount(feature: AnnotationFeature, _bpPerPx?: number): number {
    const { children, type } = feature
    if (!children) {
      return 1
    }
    let rowCount = 0
    if (type === 'mRNA') {
      for (const [, child] of children) {
        if (child.type === 'CDS') {
          rowCount += 1
        }
      }
      return rowCount
    }
    for (const [, child] of children) {
      rowCount += this.getRowCount(child)
    }
    return rowCount
  }

  draw(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    xOffset: number,
    row: number,
    reversed: boolean,
  ): void {
    const { apolloRowHeight, lgv, session, theme } = stateModel
    const { bpPerPx } = lgv
    const rowHeight = apolloRowHeight
    const exonHeight = Math.round(0.6 * rowHeight)
    const cdsHeight = Math.round(0.9 * rowHeight)
    const { min, strand } = feature
    const { children } = feature
    if (!children) {
      return
    }
    const { apolloSelectedFeature } = session

    // Draw lines on different rows for each mRNA
    let currentRow = 0
    for (const [, mrna] of children) {
      if (mrna.type !== 'mRNA') {
        currentRow += 1
        continue
      }
      const { children: childrenOfmRNA } = mrna
      if (!childrenOfmRNA) {
        continue
      }
      for (const [, cds] of childrenOfmRNA) {
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
    for (const [, child] of children) {
      if (child.type !== 'mRNA') {
        boxGlyph.draw(stateModel, ctx, child, xOffset, row, reversed)
        currentRow += 1
        continue
      }
      for (const cdsRow of child.cdsLocations) {
        const { _id, children: childrenOfmRNA } = child
        if (!childrenOfmRNA) {
          continue
        }
        for (const [, exon] of childrenOfmRNA) {
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
        }
        for (const cds of cdsRow) {
          const cdsOffsetPx = (cds.min - min) / bpPerPx
          const cdsWidthPx = (cds.max - cds.min) / bpPerPx
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
            ctx.fillStyle = cdsColorCode
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
  }

  drawHover(stateModel: LinearApolloDisplay, ctx: CanvasRenderingContext2D) {
    const { apolloHover, apolloRowHeight, displayedRegions, lgv, theme } =
      stateModel
    if (!apolloHover) {
      return
    }
    const { feature, mousePosition } = apolloHover
    if (!(feature && mousePosition)) {
      return
    }
    const { regionNumber, y } = mousePosition
    const displayedRegion = displayedRegions[regionNumber]
    const { refName, reversed } = displayedRegion
    const { bpPerPx, offsetPx } = lgv
    const { length, max, min } = feature
    const startPx =
      (lgv.bpToPx({ refName, coord: reversed ? max : min, regionNumber })
        ?.offsetPx ?? 0) - offsetPx
    const row = Math.floor(y / apolloRowHeight)
    const top = row * apolloRowHeight
    const widthPx = length / bpPerPx
    ctx.fillStyle = theme?.palette.action.selected ?? 'rgba(0,0,0,04)'
    ctx.fillRect(
      startPx,
      top,
      widthPx,
      apolloRowHeight * this.getRowCount(feature),
    )
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
    const { mousePosition: currentMousePosition } = apolloDragging.current
    const edge = this.isMouseOnFeatureEdge(
      startingMousePosition,
      feature,
      stateModel,
      topLevelFeature,
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
   * Check If the mouse position is on the edge of the given feature
   */
  isMouseOnFeatureEdge(
    mousePosition: MousePosition,
    feature: AnnotationFeature,
    stateModel: LinearApolloDisplay,
    topLevelFeature?: AnnotationFeature,
  ) {
    const { bp, refName, regionNumber, x } = mousePosition
    const { lgv } = stateModel
    const { offsetPx } = lgv
    const parentFeature = this.getParentFeature(feature, topLevelFeature)
    let startPxInfo: { index: number; offsetPx: number } | undefined
    let endPxInfo: { index: number; offsetPx: number } | undefined

    if (feature.type === 'CDS' && parentFeature) {
      let cdsLocation
      const { cdsLocations } = parentFeature
      for (const cdsLocRow of cdsLocations) {
        for (const cdsLoc of cdsLocRow) {
          if (bp >= cdsLoc.min && bp <= cdsLoc.max) {
            cdsLocation = cdsLoc
            break
          }
        }
      }
      if (!cdsLocation) {
        return
      }
      startPxInfo = lgv.bpToPx({
        refName,
        coord: cdsLocation.min,
        regionNumber,
      })
      endPxInfo = lgv.bpToPx({
        refName,
        coord: cdsLocation.max,
        regionNumber,
      })
    } else {
      startPxInfo = lgv.bpToPx({ refName, coord: feature.min, regionNumber })
      endPxInfo = lgv.bpToPx({ refName, coord: feature.max, regionNumber })
    }

    if (startPxInfo === undefined || endPxInfo === undefined) {
      return
    }
    const startPx = startPxInfo.offsetPx - offsetPx
    const endPx = endPxInfo.offsetPx - offsetPx
    // Don't find edges for features that are small on-screen
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
    // cds drag limit issue
    if (Math.abs(startPx - x) < 4) {
      return 'min'
    }
    if (Math.abs(endPx - x) < 4) {
      return 'max'
    }
  }

  onMouseMove(stateModel: LinearApolloDisplay, event: CanvasMouseEvent) {
    const { feature, mousePosition, topLevelFeature } =
      stateModel.getFeatureAndGlyphUnderMouse(event)
    console.log(feature.type, topLevelFeature.type)
    // if (stateModel.apolloDragging) {
    //   stateModel.setCursor('col-resize')
    //   return
    // }
    // if (feature && mousePosition) {
    //   const edge = this.isMouseOnFeatureEdge(
    //     mousePosition,
    //     feature,
    //     stateModel,
    //     topLevelFeature,
    //   )
    //   if (edge) {
    //     stateModel.setCursor('col-resize')
    //   } else {
    //     stateModel.setCursor()
    //   }
    // }
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
    return { prevExon, matchingExon, nextExon }
  }

  exonCDSRelation(
    cds?: AnnotationFeature,
    topLevelFeature?: AnnotationFeature,
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
    exon: AnnotationFeature,
    cds: AnnotationFeature,
    parentFeature: AnnotationFeature,
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
    exon: AnnotationFeature,
    topLevelFeature?: AnnotationFeature,
  ): CDSDiscontinuousLocation[] {
    const dls: CDSDiscontinuousLocation[] = []
    const parentFeature = this.getParentFeature(exon, topLevelFeature)
    if (!parentFeature?.children || !topLevelFeature) {
      return dls
    }
    const cdsFeatures: AnnotationFeature[] = []
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
    exon: AnnotationFeature,
    topLevelFeature?: AnnotationFeature,
  ) {
    const parentFeature: AnnotationFeature = this.getParentFeature(
      exon,
      topLevelFeature,
    )
    if (!parentFeature.children) {
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
    const { feature, glyph, mousePosition, topLevelFeature } =
      stateModel.apolloDragging?.start ?? {}
    if (!mousePosition) {
      return
    }
    const { bp } = currentMousePosition
    if (!feature) {
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
      const { matchingExon } = this.adjacentExonsOfCdsDL(
        discontinuousLocation,
        exonCDSRelations,
      )
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
      if (adjacentExons?.nextExon && bp >= adjacentExons.nextExon.min - 1) {
        return
      }
      if (adjacentExons?.prevExon && bp <= adjacentExons.prevExon.max + 1) {
        return
      }
      const dls: CDSDiscontinuousLocation[] = this.cdsDlsForExon(
        feature,
        topLevelFeature,
      )
      if (dls.length > 0) {
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
    feature: AnnotationFeature,
    bp: number,
    row: number,
  ): AnnotationFeature | undefined {
    const featuresForRow: AnnotationFeature[] =
      this.featuresForRow(feature)[row]
    for (const f of featuresForRow) {
      if (bp >= f.min && bp <= f.max && f.parent) {
        return f
      }
    }
    return feature
  }

  getRowForFeature(
    feature: AnnotationFeature,
    childFeature: AnnotationFeature,
  ) {
    const rows = this.featuresForRow(feature)
    for (const [idx, row] of rows.entries()) {
      if (row.some((feature) => feature._id === childFeature._id)) {
        return idx
      }
    }
    return
  }

  async executeDrag(stateModel: LinearApolloDisplay) {
    const { apolloDragging, changeManager, displayedRegions } = stateModel
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
    const assembly = stateModel.getAssemblyId(region.assemblyName)
    const changes: (LocationStartChange | LocationEndChange)[] = []
    const parentFeature = glyph.getParentFeature(feature, topLevelFeature)
    const cdsLocs = glyph.getDiscontinuousLocations(parentFeature, feature)
    if (edge === 'min') {
      if (
        discontinuousLocation?.idx !== undefined &&
        cdsLocs &&
        cdsLocs.length > 0
      ) {
        this.addStartLocationChange(changes, feature, newBp, assembly)
        // feature.setMin(newBp)
        const exonCDSRelations = this.exonCDSRelation(feature, topLevelFeature)
        const exonForCds = this.adjacentExonsOfCdsDL(
          discontinuousLocation,
          exonCDSRelations,
        )
        if (exonForCds.matchingExon && newBp < exonForCds.matchingExon.min) {
          this.addStartLocationChange(
            changes,
            exonForCds.matchingExon,
            newBp,
            assembly,
          )
          // exonForCds.matchingExon.setMin(newBp)
        }
      } else {
        this.addStartLocationChange(changes, feature, newBp, assembly)
        // feature.setMin(newBp)
      }
    } else {
      if (
        discontinuousLocation?.idx !== undefined &&
        cdsLocs &&
        cdsLocs.length > 0
      ) {
        this.addEndLocationChange(changes, feature, newBp, assembly)
        // feature.setMax(newBp)
        const exonCDSRelations = this.exonCDSRelation(feature, topLevelFeature)
        const exonForCds = this.adjacentExonsOfCdsDL(
          discontinuousLocation,
          exonCDSRelations,
        )
        if (exonForCds.matchingExon && newBp > exonForCds.matchingExon.max) {
          this.addEndLocationChange(
            changes,
            exonForCds.matchingExon,
            newBp,
            assembly,
          )
          // exonForCds.matchingExon.setMax(newBp)
        }
      } else {
        this.addEndLocationChange(changes, feature, newBp, assembly)
        // feature.setMax(newBp)
      }
    }
    for (const change of changes) {
      await changeManager.submit(change)
    }
    stateModel.setCursor()
  }

  addStartLocationChange(
    changes: LocationChange[],
    feature: AnnotationFeature,
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

  addEndLocationChange(
    changes: LocationChange[],
    feature: AnnotationFeature,
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
