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

export class CanonicalGeneGlyph extends Glyph {
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
    xOffset: number,
    row: number,
    reversed: boolean,
  ): void {
    const { lgv, session, theme } = stateModel
    const { bpPerPx } = lgv
    const rowHeight = stateModel.apolloRowHeight
    const utrHeight = Math.round(0.6 * rowHeight)
    const cdsHeight = Math.round(0.9 * rowHeight)
    const { strand } = feature
    let currentCDS = 0
    feature.children?.forEach((mrna: AnnotationFeatureI) => {
      if (mrna.type !== 'mRNA') {
        return
      }
      mrna.children?.forEach((cds: AnnotationFeatureI) => {
        if (cds.type !== 'CDS') {
          return
        }
        const offsetPx = (mrna.start - feature.min) / bpPerPx
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
      })
    })
    currentCDS = 0
    feature.children?.forEach((mrna: AnnotationFeatureI) => {
      if (mrna.type !== 'mRNA') {
        return
      }
      const cdsCount = [...(mrna.children ?? [])].filter(
        ([, exonOrCDS]) => exonOrCDS.type === 'CDS',
      ).length
      // eslint-disable-next-line unicorn/no-useless-undefined
      new Array(cdsCount).fill(undefined).forEach(() => {
        mrna.children?.forEach((exon: AnnotationFeatureI) => {
          if (exon.type !== 'exon') {
            return
          }
          const offsetPx = (exon.start - feature.min) / bpPerPx
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
            ctx.fillStyle = 'rgb(211,211,211)'
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
        if (cds.discontinuousLocations) {
          for (const cdsLocation of cds.discontinuousLocations) {
            const offsetPx = (cdsLocation.start - feature.min) / bpPerPx
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
              ctx.fillStyle = 'rgb(255,165,0)'
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
      })
    })
    const { apolloSelectedFeature } = session
    if (apolloSelectedFeature && feature._id === apolloSelectedFeature._id) {
      const widthPx = feature.max - feature.min
      const startPx = reversed ? xOffset - widthPx : xOffset
      const top = row * rowHeight
      const height = this.getRowCount(feature, bpPerPx) * rowHeight
      ctx.fillStyle = theme?.palette.action.selected ?? 'rgba(0,0,0,0.08)'
      ctx.fillRect(startPx, top, widthPx, height)
    }
  }

  drawHover(stateModel: LinearApolloDisplay, ctx: CanvasRenderingContext2D) {
    const hover = stateModel.apolloHover
    if (!hover) {
      return
    }
    const { mousePosition, topLevelFeature } = hover
    if (!(topLevelFeature && mousePosition)) {
      return
    }
    const rowHeight = stateModel.apolloRowHeight
    const rowNumber = Math.floor(mousePosition.y / rowHeight)
    const { featureLayouts } = stateModel
    const layout = featureLayouts[mousePosition.regionNumber]
    const row = layout.get(rowNumber)
    const featureRowEntry = row?.find(
      ([, feature]) => feature._id === topLevelFeature._id,
    )
    if (!featureRowEntry) {
      return
    }
    const displayedRegion =
      stateModel.displayedRegions[mousePosition.regionNumber]
    const x =
      (stateModel.lgv.bpToPx({
        refName: displayedRegion.refName,
        coord: topLevelFeature.min,
        regionNumber: mousePosition.regionNumber,
      })?.offsetPx ?? 0) - stateModel.lgv.offsetPx
    const [featureRowNumber] = featureRowEntry
    const topRowNumber = rowNumber - featureRowNumber
    const y = topRowNumber * rowHeight
    const { bpPerPx } = stateModel.lgv
    const width = topLevelFeature.end - topLevelFeature.start
    const widthPx = width / bpPerPx
    const startBp = displayedRegion.reversed
      ? topLevelFeature.max - topLevelFeature.end
      : topLevelFeature.start - topLevelFeature.min
    const startPx = startBp / bpPerPx
    ctx.fillStyle = stateModel.theme?.palette.action.focus ?? 'rgba(0,0,0,0.04)'
    const height = this.getRowCount(topLevelFeature, bpPerPx) * rowHeight
    ctx.fillRect(x + startPx, y, widthPx, height)
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
