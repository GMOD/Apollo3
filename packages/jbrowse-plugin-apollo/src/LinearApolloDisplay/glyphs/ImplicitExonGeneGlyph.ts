import { AnnotationFeatureI } from 'apollo-mst'

import { LinearApolloDisplay } from '../stateModel'
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
    feature.children?.forEach((child: AnnotationFeatureI) => {
      const childFeatures: AnnotationFeatureI[] = []
      child.children?.forEach((annotationFeature: AnnotationFeatureI) => {
        childFeatures.push(annotationFeature)
      })
      features.push(childFeatures)
    })
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
    const { children, min, strand } = feature
    const { apolloSelectedFeature } = session
    let currentMRNA = 0
    for (const [, mrna] of children ?? new Map()) {
      if (mrna.type !== 'mRNA') {
        return
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
        return
      }
      const cdsCount = [...(mrna.children ?? [])].filter(
        ([, exonOrCDS]) => exonOrCDS.type === 'CDS',
      ).length
      for (let count = 0; count < cdsCount; count++) {
        for (const [, cdsOrUTR] of mrna.children ?? new Map()) {
          const isCDS = cdsOrUTR.type === 'CDS'
          const isUTR = cdsOrUTR.type.endsWith('UTR')
          if (!(isCDS || isUTR)) {
            return
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

    // hightlight selected row
    if (apolloSelectedFeature) {
      let featureEntry: AnnotationFeatureI | undefined
      let featureRow: number | undefined
      let idx = 0
      children?.forEach((f: AnnotationFeatureI) => {
        f.children?.forEach((cf: AnnotationFeatureI) => {
          if (cf._id === apolloSelectedFeature?._id) {
            featureEntry = f
            featureRow = idx
          }
        })
        idx++
      })

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
    const { feature, mousePosition } = apolloHover
    if (!(feature && mousePosition)) {
      return
    }
    const { regionNumber, y } = mousePosition
    const { bpPerPx, bpToPx, offsetPx } = lgv
    const rowHeight = apolloRowHeight
    const rowNumber = Math.floor(y / rowHeight)
    const layout = featureLayouts[regionNumber]
    const row = layout.get(rowNumber)

    let featureEntry: AnnotationFeatureI | undefined
    if (row) {
      for (const [, featureObj] of row) {
        featureObj.children?.forEach((f: AnnotationFeatureI) => {
          f.children?.forEach((cf: AnnotationFeatureI) => {
            if (feature?._id === cf._id) {
              featureEntry = f
            }
          })
        })
      }
    }

    if (!featureEntry) {
      return
    }
    const displayedRegion = displayedRegions[regionNumber]
    const { refName, reversed } = displayedRegion
    const startPx =
      (bpToPx({
        refName,
        coord: reversed ? featureEntry.end : featureEntry.start,
        regionNumber,
      })?.offsetPx ?? 0) - offsetPx
    const top = rowNumber * rowHeight
    const widthPx = featureEntry.length / bpPerPx
    ctx.fillStyle = theme?.palette.action.focus ?? 'rgba(0,0,0,0.04)'
    ctx.fillRect(startPx, top, widthPx, rowHeight)
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
    bp: number,
    row: number,
  ): AnnotationFeatureI | undefined {
    const layoutRow = this.featuresForRow(feature)[row]
    return layoutRow?.find((f) => bp >= f.start && bp <= f.end)
  }
}
