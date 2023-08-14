import { AnnotationFeatureI } from 'apollo-mst'

import { LinearApolloDisplay } from '../stateModel'
import { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import { CanvasMouseEvent } from '../types'
import { Glyph } from './Glyph'

export class GenericChildGlyph extends Glyph {
  featuresForRow(feature: AnnotationFeatureI): AnnotationFeatureI[][] {
    const features = [[feature]]
    if (feature.children) {
      feature.children?.forEach((child: AnnotationFeatureI) => {
        features.push(...this.featuresForRow(child))
      })
    }
    return features
  }

  getRowCount(feature: AnnotationFeatureI) {
    return this.featuresForRow(feature).length
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
    const featureId = `Id: ${feature.gffId}`
    const featureStart = `Start: ${feature.start.toString()}`
    const featureEnd = `End: ${feature.end.toString()}`
    const textWidth = [
      context.measureText(featureType).width,
      context.measureText(featureId).width,
      context.measureText(featureStart).width,
      context.measureText(featureEnd).width,
    ]
    const maxWidth = Math.max(...textWidth)

    startPx = startPx + widthPx + 2
    context.fillStyle = 'rgba(1, 1, 1, 0.7)'
    context.fillRect(startPx, top, maxWidth + 4, 55)
    context.fillStyle = 'rgba(255, 255, 255)'
    let textTop = top + 12
    context.fillText(featureType, startPx + 2, textTop)
    textTop = textTop + 12
    context.fillText(featureId, startPx + 2, textTop)
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
  ) {
    for (let i = 0; i < this.getRowCount(feature); i++) {
      this.drawRow(stateModel, ctx, feature, xOffset, row + i, row, reversed)
    }
  }

  drawRow(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    topLevelFeature: AnnotationFeatureI,
    xOffset: number,
    row: number,
    topRow: number,
    reversed: boolean,
  ) {
    const features = this.featuresForRow(topLevelFeature)[row - topRow]
    const { lgv, theme, apolloRowHeight, session } = stateModel
    const { bpPerPx } = lgv
    const { apolloSelectedFeature } = session
    const top = row * apolloRowHeight

    features.forEach((feature) => {
      const offsetPx = (feature.start - topLevelFeature.min) / bpPerPx
      const widthPx = feature.length / bpPerPx
      const startPx = reversed
        ? xOffset - offsetPx - widthPx
        : xOffset + offsetPx
      const rowCount = this.getRowCount(feature)
      if (rowCount > 1) {
        const featureHeight = rowCount * apolloRowHeight
        ctx.fillStyle =
          apolloSelectedFeature && feature._id === apolloSelectedFeature._id
            ? 'rgba(130,0,0,0.45)'
            : 'rgba(255,0,0,0.25)'
        ctx.fillRect(startPx, top, widthPx, featureHeight)
      }
      ctx.fillStyle = theme?.palette.text.primary ?? 'black'
      ctx.fillRect(startPx, top, widthPx, apolloRowHeight)
      if (widthPx > 2) {
        const backgroundColor =
          apolloSelectedFeature && feature._id === apolloSelectedFeature._id
            ? theme?.palette.text.primary ?? 'black'
            : theme?.palette.background.default ?? 'white'
        const textColor =
          apolloSelectedFeature && feature._id === apolloSelectedFeature._id
            ? theme?.palette.getContrastText(backgroundColor) ?? 'white'
            : theme?.palette.text.primary ?? 'black'
        ctx.clearRect(startPx + 1, top + 1, widthPx - 2, apolloRowHeight - 2)
        ctx.fillStyle = backgroundColor
        ctx.fillRect(startPx + 1, top + 1, widthPx - 2, apolloRowHeight - 2)
        ctx.fillStyle = textColor
        const textStart = Math.max(startPx + 1, 0)
        const textWidth = startPx - 1 + widthPx - textStart
        feature.type &&
          ctx.fillText(feature.type, textStart, top + 11, textWidth)
      }
    })
    if (features.length > 1) {
      let [{ start, end }] = features
      features.forEach((feature) => {
        start = Math.min(start, feature.start)
        end = Math.max(end, feature.end)
      })
      const width = end - start
      const startPx = (start - topLevelFeature.start) / bpPerPx
      const widthPx = width / bpPerPx
      ctx.fillStyle = 'rgba(0,255,255,0.2)'
      ctx.fillRect(startPx + 1, top + 1, widthPx - 2, apolloRowHeight - 2)
    }
  }

  drawHover(stateModel: LinearApolloDisplay, ctx: CanvasRenderingContext2D) {
    const { apolloHover, lgv, apolloRowHeight, displayedRegions } = stateModel
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
    const startPx =
      (bpToPx({ refName, coord: reversed ? end : start, regionNumber })
        ?.offsetPx ?? 0) - offsetPx
    const row = Math.floor(y / apolloRowHeight)
    const top = row * apolloRowHeight
    const widthPx = length / bpPerPx
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(
      startPx,
      top,
      widthPx,
      apolloRowHeight * this.getRowCount(feature),
    )
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

  getFeatureFromLayout(feature: AnnotationFeatureI, bp: number, row: number) {
    const layoutRow = this.featuresForRow(feature)[row]
    return layoutRow?.find((f) => bp >= f.start && bp <= f.end)
  }
}
