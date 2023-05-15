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

export class GeneGlyph extends Glyph {
  getRowCount(feature: AnnotationFeatureI, _bpPerPx: number): number {
    let cdsCount = 0
    feature.children?.forEach((child: AnnotationFeatureI) => {
      child.children?.forEach((grandchild: AnnotationFeatureI) => {
        if (grandchild.type === 'CDS') {
          cdsCount += 1
        }
      })
    })
    return cdsCount
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
    let currentCDS = 0
    feature.children?.forEach((mrna: AnnotationFeatureI) => {
      if (mrna.type !== 'mRNA') {
        return
      }
      mrna.children?.forEach((cds: AnnotationFeatureI) => {
        if (cds.type !== 'CDS') {
          return
        }
        const startX = (mrna.start - feature.min) / bpPerPx + x
        const height = Math.round((currentCDS + 1) * rowHeight - rowHeight / 2)
        ctx.strokeStyle = theme?.palette.text.primary || 'black'
        ctx.beginPath()
        ctx.moveTo(startX, height)
        ctx.lineTo(startX + mrna.length / bpPerPx, height)
        ctx.stroke()
        currentCDS += 1
      })
    })
    currentCDS = 0
    feature.children?.forEach((mrna: AnnotationFeatureI) => {
      if (mrna.type !== 'mRNA') {
        return
      }
      const cdsCount = Array.from(mrna.children || []).filter(
        ([, exonOrCDS]) => exonOrCDS.type === 'CDS',
      ).length
      new Array(cdsCount).fill(undefined).forEach(() => {
        mrna.children?.forEach((exon: AnnotationFeatureI) => {
          if (exon.type !== 'exon') {
            return
          }
          const widthPx = exon.length / bpPerPx
          const startBp = reversed
            ? feature.max - exon.end
            : exon.start - feature.min
          const startPx = startBp / bpPerPx
          ctx.fillStyle = theme?.palette.text.primary || 'black'
          const yOffset = currentCDS * rowHeight + (rowHeight - utrHeight) / 2
          ctx.fillRect(x + startPx, y + yOffset, widthPx, utrHeight)
          if (widthPx > 2) {
            ctx.clearRect(
              x + startPx + 1,
              y + yOffset + 1,
              widthPx - 2,
              utrHeight - 2,
            )
            ctx.fillStyle = 'rgb(211,211,211)'
            ctx.fillRect(
              x + startPx + 1,
              y + yOffset + 1,
              widthPx - 2,
              utrHeight - 2,
            )
            if (forwardFill && backwardFill) {
              ctx.fillStyle = forwardFill
              ctx.fillRect(
                x + startPx + 1,
                y + yOffset + 1,
                widthPx - 2,
                (utrHeight - 2) / 2,
              )
              ctx.fillStyle = backwardFill
              ctx.fillRect(
                x + startPx + 1,
                y + yOffset + 1 + (utrHeight - 2) / 2,
                widthPx - 2,
                (utrHeight - 2) / 2,
              )
            }
          }
        })
        currentCDS += 1
      })
    })
    currentCDS = 0
    feature.children?.forEach((mrna: AnnotationFeatureI) => {
      if (mrna.type !== 'mRNA') {
        return
      }
      mrna.children?.forEach((cds: AnnotationFeatureI) => {
        if (cds.type !== 'CDS') {
          return
        }
        cds.discontinuousLocations?.forEach((cdsLocation) => {
          const widthPx = (cdsLocation.end - cdsLocation.start) / bpPerPx
          const startBp = reversed
            ? feature.max - cdsLocation.end
            : cdsLocation.start - feature.min
          const startPx = startBp / bpPerPx
          ctx.fillStyle = theme?.palette.text.primary || 'black'
          const yOffset = currentCDS * rowHeight + (rowHeight - cdsHeight) / 2
          ctx.fillRect(x + startPx, y + yOffset, widthPx, cdsHeight)
          if (widthPx > 2) {
            ctx.clearRect(
              x + startPx + 1,
              y + yOffset + 1,
              widthPx - 2,
              cdsHeight - 2,
            )

            ctx.fillStyle = 'rgb(255,165,0)'
            ctx.fillRect(
              x + startPx + 1,
              y + yOffset + 1,
              widthPx - 2,
              cdsHeight - 2,
            )
            if (forwardFill && backwardFill) {
              ctx.fillStyle = forwardFill
              ctx.fillRect(
                x + startPx + 1,
                y + yOffset + 1,
                widthPx - 2,
                (cdsHeight - 2) / 2,
              )
              ctx.fillStyle = backwardFill
              ctx.fillRect(
                x + startPx + 1,
                y + yOffset + 1 + (cdsHeight - 2) / 2,
                widthPx - 2,
                (cdsHeight - 2) / 2,
              )
            }
          }
        })
        currentCDS += 1
      })
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
