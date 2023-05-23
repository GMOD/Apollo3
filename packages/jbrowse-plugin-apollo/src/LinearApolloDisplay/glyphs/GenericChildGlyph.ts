import { AnnotationFeatureI } from 'apollo-mst'

import { LinearApolloDisplay } from '../stateModel'
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

  draw(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeatureI,
    x: number,
    y: number,
    reversed: boolean,
  ) {
    const rowHeight = stateModel.apolloRowHeight
    const { lgv } = stateModel
    const { bpPerPx } = lgv
    for (let i = 0; i < this.getRowCount(feature); i++) {
      this.drawRow(
        i,
        ctx,
        x,
        y + i * rowHeight,
        bpPerPx,
        rowHeight,
        feature,
        reversed,
      )
    }
  }

  drawRow(
    rowNumber: number,
    ctx: CanvasRenderingContext2D,
    xOffset: number,
    yOffset: number,
    bpPerPx: number,
    rowHeight: number,
    f: AnnotationFeatureI,
    reversed?: boolean,
  ) {
    const features = this.featuresForRow(f)[rowNumber]

    features.forEach((feature) => {
      const width = feature.end - feature.start
      const widthPx = width / bpPerPx
      const startBp = reversed ? f.end - feature.end : feature.start - f.start
      const startPx = startBp / bpPerPx
      const rowCount = this.getRowCount(feature)
      if (rowCount > 1) {
        const featureHeight = rowCount * rowHeight
        ctx.fillStyle = 'rgba(255,0,0,0.25)'
        ctx.fillRect(xOffset + startPx, yOffset, widthPx, featureHeight)
      }
      ctx.fillStyle = 'black'
      ctx.fillRect(xOffset + startPx, yOffset, widthPx, rowHeight)
      if (widthPx > 2) {
        ctx.clearRect(
          xOffset + startPx + 1,
          yOffset + 1,
          widthPx - 2,
          rowHeight - 2,
        )
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.fillRect(
          xOffset + startPx + 1,
          yOffset + 1,
          widthPx - 2,
          rowHeight - 2,
        )
        ctx.fillStyle = 'black'
        feature.type &&
          ctx.fillText(
            feature.type,
            xOffset + startPx + 1,
            yOffset + 11,
            widthPx - 2,
          )
      }
    })
    if (features.length > 1) {
      let [{ start, end }] = features
      features.forEach((feature) => {
        start = Math.min(start, feature.start)
        end = Math.max(end, feature.end)
      })
      const width = end - start
      const startPx = (start - f.start) / bpPerPx
      const widthPx = width / bpPerPx
      ctx.fillStyle = 'rgba(0,255,255,0.2)'
      ctx.fillRect(
        xOffset + startPx + 1,
        yOffset + 1,
        widthPx - 2,
        rowHeight - 2,
      )
    }
  }

  drawHover(stateModel: LinearApolloDisplay, ctx: CanvasRenderingContext2D) {
    const { apolloHover, apolloRowHeight, lgv } = stateModel
    if (!apolloHover) {
      return
    }
    const { bpPerPx } = lgv
    const { feature, mousePosition } = apolloHover
    const rowNumber = Math.floor(mousePosition.y / apolloRowHeight)
    const { regionNumber } = mousePosition
    const displayedRegion = stateModel.displayedRegions[regionNumber]
    if (feature && rowNumber !== undefined) {
      // const start = displayedRegion.reversed
      //   ? displayedRegion.end - feature.end
      //   : feature.start - displayedRegion.start - 1
      const width = feature.length
      // const startPx = start / bpPerPx
      const widthPx = width / bpPerPx
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      const x =
        (stateModel.lgv.bpToPx({
          refName: displayedRegion.refName,
          coord: feature.min,
          regionNumber,
        })?.offsetPx || 0) - stateModel.lgv.offsetPx
      ctx.fillRect(
        x,
        rowNumber * apolloRowHeight,
        widthPx,
        apolloRowHeight * this.getRowCount(feature),
      )
    }
  }

  getFeatureFromLayout(feature: AnnotationFeatureI, bp: number, row: number) {
    const layoutRow = this.featuresForRow(feature)[row]
    return layoutRow?.find((f) => bp >= f.start && bp <= f.end)
  }
}
