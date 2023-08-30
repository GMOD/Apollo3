import { alpha } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'

import { LinearApolloDisplay } from '../stateModel'
import { MousePosition } from '../stateModel/mouseEvents'
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

export class ImplicitExonGeneGlyph extends Glyph {
  featuresForRow(feature: AnnotationFeatureI): AnnotationFeatureI[][] {
    const features: AnnotationFeatureI[][] = []
    for (const [, child] of feature.children ?? new Map()) {
      const childFeatures: AnnotationFeatureI[] = []
      for (const [, annotationFeature] of child.children ?? new Map()) {
        childFeatures.push(annotationFeature)
      }
      childFeatures.push(child)
      features.push(childFeatures)
    }
    return features
  }

  getRowCount(feature: AnnotationFeatureI): number {
    let mrnaCount = 0
    for (const [, child] of feature.children ?? new Map()) {
      if (child.type === 'mRNA') {
        mrnaCount += 1
      }
    }
    return mrnaCount
  }

  draw(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeatureI,
    xOffset: number,
    row: number,
    reversed?: boolean,
  ): void {
    const { apolloRowHeight, lgv, session, theme } = stateModel
    const { bpPerPx } = lgv
    const rowHeight = apolloRowHeight
    const utrHeight = Math.round(0.6 * rowHeight)
    const cdsHeight = Math.round(0.9 * rowHeight)
    const { _id, children, min, strand } = feature
    const { apolloSelectedFeature } = session
    let currentMRNA = 0
    for (const [, mrna] of children ?? new Map()) {
      if (mrna.type !== 'mRNA') {
        continue
      }
      const offsetPx = (mrna.start - min) / bpPerPx
      const widthPx = mrna.length / bpPerPx
      const startPx = reversed
        ? xOffset - offsetPx - widthPx
        : xOffset + offsetPx
      const height =
        Math.round((currentMRNA + 1 / 2) * rowHeight) + row * rowHeight
      ctx.strokeStyle = theme?.palette.text.primary ?? 'black'
      ctx.beginPath()
      ctx.moveTo(startPx, height)
      ctx.lineTo(startPx + widthPx, height)
      ctx.stroke()
      currentMRNA += 1
    }
    currentMRNA = 0
    for (const [, mrna] of children ?? new Map()) {
      if (mrna.type !== 'mRNA') {
        continue
      }
      const cdsCount = [...(mrna.children ?? [])].filter(
        ([, exonOrCDS]) => exonOrCDS.type === 'CDS',
      ).length
      for (let count = 0; count < cdsCount; count++) {
        for (const [, cdsOrUTR] of mrna.children ?? new Map()) {
          const isCDS = cdsOrUTR.type === 'CDS'
          const isUTR = cdsOrUTR.type.endsWith('UTR')
          if (!(isCDS || isUTR)) {
            continue
          }
          const offsetPx = (cdsOrUTR.start - min) / bpPerPx
          const widthPx = cdsOrUTR.length / bpPerPx
          const startPx = reversed
            ? xOffset - offsetPx - widthPx
            : xOffset + offsetPx
          ctx.fillStyle = theme?.palette.text.primary ?? 'black'
          const top = (row + currentMRNA) * rowHeight
          const height = isCDS ? cdsHeight : utrHeight
          const cdsOrUTRTop = top + (rowHeight - height) / 2
          ctx.fillRect(startPx, cdsOrUTRTop, widthPx, height)
          if (widthPx > 2) {
            ctx.clearRect(startPx + 1, cdsOrUTRTop + 1, widthPx - 2, height - 2)
            ctx.fillStyle =
              apolloSelectedFeature &&
              cdsOrUTR._id === apolloSelectedFeature._id
                ? 'rgb(0,0,0)'
                : isCDS
                ? 'rgb(255,165,0)'
                : 'rgb(211,211,211)'
            ctx.fillRect(startPx + 1, cdsOrUTRTop + 1, widthPx - 2, height - 2)
            if (forwardFill && backwardFill && strand) {
              const reversal = reversed ? -1 : 1
              const [topFill, bottomFill] =
                strand * reversal === 1
                  ? [forwardFill, backwardFill]
                  : [backwardFill, forwardFill]
              ctx.fillStyle = topFill
              ctx.fillRect(
                startPx + 1,
                cdsOrUTRTop + 1,
                widthPx - 2,
                (height - 2) / 2,
              )
              ctx.fillStyle = bottomFill
              ctx.fillRect(
                startPx + 1,
                cdsOrUTRTop + 1 + (height - 2) / 2,
                widthPx - 2,
                (height - 2) / 2,
              )
            }
          }
        }
      }
      currentMRNA += 1
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
        const widthPx = featureEntry.length / bpPerPx
        const offsetPx = (featureEntry.start - min) / bpPerPx
        const startPx = reversed ? xOffset - widthPx : xOffset + offsetPx
        const top = (row + featureRow) * rowHeight
        ctx.fillStyle = theme?.palette.action.selected ?? 'rgba(0,0,0,08)'
        ctx.fillRect(startPx, top, widthPx, rowHeight)
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
    const { bpPerPx, bpToPx, offsetPx } = lgv
    const rowHeight = apolloRowHeight
    const rowNumber = Math.floor(y / rowHeight)
    const displayedRegion = displayedRegions[regionNumber]
    const { refName, reversed } = displayedRegion
    const startPx =
      (bpToPx({
        refName,
        coord: reversed ? feature.end : feature.start,
        regionNumber,
      })?.offsetPx ?? 0) - offsetPx
    const top = rowNumber * rowHeight
    const widthPx = feature.length / bpPerPx
    ctx.fillStyle = theme?.palette.action.focus ?? 'rgba(0,0,0,0.04)'
    ctx.fillRect(startPx, top, widthPx, rowHeight)
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

    const featureEdgeBp = region.reversed
      ? region.end - feature[edge]
      : feature[edge] - region.start
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
   * @param mousePosition - mouse position
   * @param feature - feature under the mouse
   * @param topLevelFeature - topLevelFeature
   * @param stateModel - LinearApolloDisplay model
   * @returns undefined if mouse not on the edge of this feature, otherwise 'start' or 'end' depending on which edge
   */
  isMouseOnFeatureEdge(
    mousePosition: MousePosition,
    feature: AnnotationFeatureI,
    stateModel: LinearApolloDisplay,
    topLevelFeature?: AnnotationFeatureI,
  ) {
    const { session } = stateModel
    const { apolloSelectedFeature } = session
    if (
      !mousePosition ||
      !apolloSelectedFeature ||
      feature._id !== apolloSelectedFeature._id
    ) {
      return
    }

    const { refName, regionNumber, x } = mousePosition
    const { lgv } = stateModel
    const { bpToPx, offsetPx } = lgv
    const startPxInfo = bpToPx({ refName, coord: feature.start, regionNumber })
    const endPxInfo = bpToPx({ refName, coord: feature.end, regionNumber })
    if (startPxInfo !== undefined && endPxInfo !== undefined) {
      const startPx = startPxInfo.offsetPx - offsetPx
      const endPx = endPxInfo.offsetPx - offsetPx
      if (Math.abs(endPx - startPx) < 8) {
        return
      }
      const parentFeature = this.getParentFeature(
        apolloSelectedFeature,
        topLevelFeature,
      )
      // Limit dragging till parent feature end
      if (
        parentFeature &&
        apolloSelectedFeature.start <= parentFeature.start &&
        Math.abs(startPx - x) < 4
      ) {
        return
      }
      if (
        parentFeature &&
        apolloSelectedFeature.end >= parentFeature.end &&
        Math.abs(endPx - x) < 4
      ) {
        return
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
    const { feature, mousePosition } = stateModel.apolloDragging?.start ?? {}
    if (feature && mousePosition) {
      const edge = this.isMouseOnFeatureEdge(mousePosition, feature, stateModel)
      if (edge) {
        return true
      }
    }
    return false
  }

  getFeatureFromLayout(
    feature: AnnotationFeatureI,
    bp: number,
    row: number,
  ): AnnotationFeatureI | undefined {
    const layoutRow = this.featuresForRow(feature)[row]
    return layoutRow?.find((f) => bp >= f.start && bp <= f.end)
  }
}
