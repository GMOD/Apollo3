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

export class CanonicalGeneGlyph extends Glyph {
  featuresForRow(feature: AnnotationFeatureI): AnnotationFeature[][] {
    const cdsFeatures: CDSFeatures[] = []
    feature.children?.forEach((child: AnnotationFeatureI) => {
      child.children?.forEach((annotationFeature: AnnotationFeatureI) => {
        if (annotationFeature.type === 'CDS') {
          cdsFeatures.push({
            parent: child,
            cds: annotationFeature,
          })
        }
      })
    })

    const features: AnnotationFeature[][] = []
    cdsFeatures.forEach((f: CDSFeatures) => {
      const childFeatures: AnnotationFeature[] = []
      f.parent.children?.forEach((cf: AnnotationFeatureI) => {
        if (cf.type === 'CDS' && cf._id !== f.cds._id) {
          return
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
      })
      features.push(childFeatures)
    })

    return features
  }

  getRowCount(feature: AnnotationFeatureI, _bpPerPx: number): number {
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
    const { _id, children, max, min, strand } = feature
    const { apolloSelectedFeature } = session
    let currentCDS = 0
    for (const [, mrna] of children ?? new Map()) {
      if (mrna.type !== 'mRNA') {
        return
      }
      for (const [, cds] of mrna.children ?? new Map()) {
        if (cds.type !== 'CDS') {
          return
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
        return
      }
      const cdsCount = [...(mrna.children ?? [])].filter(
        ([, exonOrCDS]) => exonOrCDS.type === 'CDS',
      ).length
      for (let count = 0; count < cdsCount; count++) {
        for (const [, exon] of mrna.children ?? new Map()) {
          if (exon.type !== 'exon') {
            return
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
        return
      }
      for (const [, cds] of mrna.children ?? new Map()) {
        if (cds.type !== 'CDS') {
          return
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

    // hightlight selected row
    if (apolloSelectedFeature) {
      const featuresForRow: AnnotationFeature[][] = this.featuresForRow(feature)
      let featureEntry: AnnotationFeatureI | undefined
      let featureRow: number | undefined

      let i = 0
      for (const row of featuresForRow) {
        for (const f of row) {
          if (apolloSelectedFeature._id === f.annotationFeature._id) {
            featureEntry = f.parent
            featureRow = i
          }
        }
        if (featureEntry) {
          break
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
    const { bpPerPx, bpToPx, offsetPx } = lgv
    const rowHeight = apolloRowHeight
    const { regionNumber, y } = mousePosition
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
    const featuresForRow: AnnotationFeature[] =
      this.featuresForRow(feature)[row]
    let featureFromLayout: AnnotationFeatureI | undefined

    for (const f of featuresForRow) {
      if (
        f.start !== undefined &&
        f.end !== undefined &&
        f.phase !== undefined
      ) {
        if (bp >= f.start && bp <= f.end) {
          featureFromLayout = f.annotationFeature
        }
      } else {
        if (bp >= f.annotationFeature.start && bp <= f.annotationFeature.end) {
          featureFromLayout = f.annotationFeature
        }
      }
    }

    return featureFromLayout
  }
}
