import { AnnotationFeatureI } from 'apollo-mst'

import { LinearApolloDisplay } from '../stateModel'
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
  getRowCount(feature: AnnotationFeatureI, _bpPerPx: number): number {
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
    x: number,
    y: number,
    reversed?: boolean,
  ): void {
    const { theme, lgv } = stateModel
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
      const startX = (mrna.start - feature.min) / bpPerPx + x
      const height =
        Math.round((currentMRNA + 1) * rowHeight - rowHeight / 2) + y
      ctx.strokeStyle = theme?.palette.text.primary || 'black'
      ctx.beginPath()
      ctx.moveTo(startX, height)
      ctx.lineTo(startX + mrna.length / bpPerPx, height)
      ctx.stroke()
      currentMRNA += 1
    })
    currentMRNA = 0
    feature.children?.forEach((mrna: AnnotationFeatureI) => {
      if (mrna.type !== 'mRNA') {
        return
      }
      const cdsCount = Array.from(mrna.children || []).filter(
        ([, exonOrCDS]) => exonOrCDS.type === 'CDS',
      ).length
      new Array(cdsCount).fill(undefined).forEach(() => {
        mrna.children?.forEach((cdsOrUTR: AnnotationFeatureI) => {
          const isCDS = cdsOrUTR.type === 'CDS'
          const isUTR = cdsOrUTR.type.endsWith('UTR')
          if (!(isCDS || isUTR)) {
            return
          }
          const widthPx = cdsOrUTR.length / bpPerPx
          const startBp = reversed
            ? feature.max - cdsOrUTR.end
            : cdsOrUTR.start - feature.min
          const startPx = startBp / bpPerPx
          ctx.fillStyle = theme?.palette.text.primary || 'black'
          const height = isCDS ? cdsHeight : utrHeight
          const yOffset = currentMRNA * rowHeight + (rowHeight - height) / 2
          ctx.fillRect(x + startPx, y + yOffset, widthPx, height)
          if (widthPx > 2) {
            ctx.clearRect(
              x + startPx + 1,
              y + yOffset + 1,
              widthPx - 2,
              height - 2,
            )
            ctx.fillStyle = isCDS ? 'rgb(255,165,0)' : 'rgb(211,211,211)'
            ctx.fillRect(
              x + startPx + 1,
              y + yOffset + 1,
              widthPx - 2,
              height - 2,
            )
            if (forwardFill && backwardFill && strand) {
              const [topFill, bottomFill] =
                strand === 1
                  ? [forwardFill, backwardFill]
                  : [backwardFill, forwardFill]
              ctx.fillStyle = topFill
              ctx.fillRect(
                x + startPx + 1,
                y + yOffset + 1,
                widthPx - 2,
                (height - 2) / 2,
              )
              ctx.fillStyle = bottomFill
              ctx.fillRect(
                x + startPx + 1,
                y + yOffset + 1 + (height - 2) / 2,
                widthPx - 2,
                (height - 2) / 2,
              )
            }
          }
        })
      })
      currentMRNA += 1
    })
  }

  getFeatureFromLayout(
    feature: AnnotationFeatureI,
    bp: number,
    row: number,
  ): AnnotationFeatureI | undefined {
    return undefined
  }
}
