import { AnnotationFeatureI } from 'apollo-mst'

import { LinearApolloDisplay } from '../stateModel'
import { CanvasMouseEvent } from '../types'
import { Glyph } from './Glyph'

let forwardFill: CanvasPattern | null = null
let backwardFill: CanvasPattern | null = null
if ('document' in window) {
  ;['forward', 'backward'].forEach((direction) => {
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
  })
}

export class ImplicitExonGeneGlyph extends Glyph {
  getRowCount(feature: AnnotationFeatureI): number {
    let mrnaCount = 0
    feature.children?.forEach((child: AnnotationFeatureI) => {
      if (child.type === 'mRNA') {
        mrnaCount += 1
      }
    })
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
    const { lgv, session, theme } = stateModel
    const { bpPerPx } = lgv
    const rowHeight = stateModel.apolloRowHeight
    const utrHeight = Math.round(0.6 * rowHeight)
    const cdsHeight = Math.round(0.9 * rowHeight)
    const { strand } = feature
    let currentMRNA = 0
    feature.children?.forEach((mrna: AnnotationFeatureI) => {
      if (mrna.type !== 'mRNA') {
        return
      }
      const offsetPx = (mrna.start - feature.min) / bpPerPx
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
    })
    currentMRNA = 0
    feature.children?.forEach((mrna: AnnotationFeatureI) => {
      if (mrna.type !== 'mRNA') {
        return
      }
      const cdsCount = Array.from(mrna.children ?? []).filter(
        ([, exonOrCDS]) => exonOrCDS.type === 'CDS',
      ).length
      new Array(cdsCount).fill(undefined).forEach(() => {
        mrna.children?.forEach((cdsOrUTR: AnnotationFeatureI) => {
          const isCDS = cdsOrUTR.type === 'CDS'
          const isUTR = cdsOrUTR.type.endsWith('UTR')
          if (!(isCDS || isUTR)) {
            return
          }
          const offsetPx = (cdsOrUTR.start - feature.min) / bpPerPx
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
            ctx.fillStyle = isCDS ? 'rgb(255,165,0)' : 'rgb(211,211,211)'
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
        })
      })
      currentMRNA += 1
    })
    const { apolloSelectedFeature } = session
    if (apolloSelectedFeature && feature._id === apolloSelectedFeature._id) {
      const widthPx = feature.max - feature.min
      const startPx = reversed ? xOffset - widthPx : xOffset
      const top = row * rowHeight
      const height = this.getRowCount(feature) * rowHeight
      ctx.fillStyle = theme?.palette.action.selected ?? 'rgba(0,0,0,0.08)'
      ctx.fillRect(startPx, top, widthPx, height)
    }
  }

  drawHover(stateModel: LinearApolloDisplay, ctx: CanvasRenderingContext2D) {
    const {
      apolloHover,
      apolloRowHeight,
      displayedRegions,
      featureLayouts,
      lgv,
      theme,
    } = stateModel
    if (!apolloHover) {
      return
    }
    const { mousePosition, topLevelFeature } = apolloHover
    if (!(topLevelFeature && mousePosition)) {
      return
    }
    const { regionNumber, y } = mousePosition
    const { bpPerPx, bpToPx, offsetPx } = lgv
    const rowHeight = apolloRowHeight
    const rowNumber = Math.floor(y / rowHeight)
    const layout = featureLayouts[regionNumber]
    const row = layout.get(rowNumber)

    const { _id, end, length, start } = topLevelFeature
    const featureRowEntry = row?.find(([, feature]) => feature._id === _id)
    if (!featureRowEntry) {
      return
    }
    const displayedRegion = displayedRegions[regionNumber]
    const { refName, reversed } = displayedRegion
    const startPx =
      (bpToPx({ refName, coord: reversed ? end : start, regionNumber })
        ?.offsetPx ?? 0) - offsetPx
    const [featureRowNumber] = featureRowEntry
    const topRowNumber = rowNumber - featureRowNumber
    const top = topRowNumber * rowHeight
    const widthPx = length / bpPerPx
    ctx.fillStyle = theme?.palette.action.focus ?? 'rgba(0,0,0,0.04)'
    const height = this.getRowCount(topLevelFeature) * rowHeight
    ctx.fillRect(startPx, top, widthPx, height)
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

  getFeatureFromLayout(
    feature: AnnotationFeatureI,
  ): AnnotationFeatureI | undefined {
    return feature
  }
}
