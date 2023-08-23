import { AnnotationFeatureI } from 'apollo-mst'

import { LinearApolloDisplay } from '../stateModel'
import { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
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

  drawTooltip(
    linearApolloDisplayMouseEvents: LinearApolloDisplayMouseEvents,
    context: CanvasRenderingContext2D,
  ) {
    const { apolloHover, lgv, apolloRowHeight, displayedRegions } =
      linearApolloDisplayMouseEvents
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
    const { bpPerPx, bpToPx, offsetPx } = lgv
    const { start, end, length } = feature
    let startPx =
      (bpToPx({ refName, coord: reversed ? end : start, regionNumber })
        ?.offsetPx ?? 0) - offsetPx
    const row = Math.floor(y / apolloRowHeight)
    const top = row * apolloRowHeight
    const widthPx = length / bpPerPx

    const featureType = `Type: ${feature.type}`
    const featureName = feature.attributes
      .get('gff_name')
      ?.find((name) => name !== '')
    const featureStart = `Start: ${feature.start.toString()}`
    const featureEnd = `End: ${feature.end.toString()}`
    const textWidth = [
      context.measureText(featureType).width,
      context.measureText(featureStart).width,
      context.measureText(featureEnd).width,
    ]
    if (featureName) {
      textWidth.push(context.measureText(`Name: ${featureName}`).width)
    }
    const maxWidth = Math.max(...textWidth)

    startPx = startPx + widthPx + 5
    context.fillStyle = 'rgba(1, 1, 1, 0.7)'
    context.fillRect(
      startPx,
      top,
      maxWidth + 4,
      textWidth.length === 4 ? 55 : 45,
    )
    context.beginPath()
    context.moveTo(startPx, top)
    context.lineTo(startPx - 5, top + 5)
    context.lineTo(startPx, top + 10)
    context.fill()
    context.fillStyle = 'rgba(255, 255, 255)'
    let textTop = top + 12
    context.fillText(featureType, startPx + 2, textTop)
    if (featureName) {
      textTop = textTop + 12
      context.fillText(`Name: ${featureName}`, startPx + 2, textTop)
    }
    textTop = textTop + 12
    context.fillText(featureStart, startPx + 2, textTop)
    textTop = textTop + 12
    context.fillText(featureEnd, startPx + 2, textTop)
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
}
