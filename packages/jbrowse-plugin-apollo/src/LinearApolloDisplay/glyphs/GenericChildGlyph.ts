import { AnnotationFeature } from '@apollo-annotation/mst'

import { LinearApolloDisplay } from '../stateModel'
import { MousePosition } from '../stateModel/mouseEvents'
import { CanvasMouseEvent } from '../types'
import { boxGlyph } from './BoxGlyph'
import { Glyph } from './Glyph'

export class GenericChildGlyph implements Glyph {
  featuresForRow(feature: AnnotationFeature): AnnotationFeature[][] {
    const features = [[feature]]
    if (feature.children) {
      for (const [, child] of feature.children) {
        features.push(...this.featuresForRow(child))
      }
    }
    return features
  }

  getRowCount(feature: AnnotationFeature) {
    return this.featuresForRow(feature).length
  }

  draw(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
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
    topLevelFeature: AnnotationFeature,
    xOffset: number,
    row: number,
    topRow: number,
    reversed: boolean,
  ) {
    const features = this.featuresForRow(topLevelFeature)[row - topRow]
    for (const feature of features) {
      this.drawFeature(
        stateModel,
        ctx,
        topLevelFeature,
        feature,
        xOffset,
        row,
        reversed,
      )
    }
  }

  private drawFeature(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    topLevelFeature: AnnotationFeature,
    feature: AnnotationFeature,
    xOffset: number,
    row: number,
    reversed: boolean,
  ) {
    const { apolloRowHeight: heightPx, lgv, session } = stateModel
    const { bpPerPx } = lgv
    const { apolloSelectedFeature } = session
    const offsetPx = (feature.min - topLevelFeature.minWithChildren) / bpPerPx
    const widthPx = feature.length / bpPerPx
    const startPx = reversed ? xOffset - offsetPx - widthPx : xOffset + offsetPx
    const top = row * heightPx
    const rowCount = this.getRowCount(feature)
    const isSelected = this.getIsSelectedFeature(feature, apolloSelectedFeature)
    const groupingColor = isSelected
      ? 'rgba(130,0,0,0.45)'
      : 'rgba(255,0,0,0.25)'
    if (rowCount > 1) {
      // draw background that encapsulates all child features
      const featureHeight = rowCount * heightPx
      this.drawBox(ctx, startPx, top, widthPx, featureHeight, groupingColor)
    }
    super.draw(stateModel, ctx, feature, startPx, row, reversed)
  }

  drawHover(stateModel: LinearApolloDisplay, ctx: CanvasRenderingContext2D) {
    const { apolloHover, apolloRowHeight, displayedRegions, lgv } = stateModel
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
    const { bpPerPx, offsetPx } = lgv
    const { length, max, min } = feature
    const startPx =
      (lgv.bpToPx({ refName, coord: reversed ? max : min, regionNumber })
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

  continueDrag(
    _display: LinearApolloDisplay,
    _currentMousePosition: MousePosition,
  ): void {
    // pass
  }

  getFeatureFromLayout(feature: AnnotationFeature, bp: number, row: number) {
    const layoutRow = this.featuresForRow(feature)[row]
    return layoutRow.find((f) => bp >= f.min && bp <= f.max)
  }

  getRowForFeature(
    feature: AnnotationFeature,
    childFeature: AnnotationFeature,
  ) {
    const rows = this.featuresForRow(feature)
    for (const [idx, row] of rows.entries()) {
      if (row.some((feature) => feature._id === childFeature._id)) {
        return idx
      }
    }
    return
  }
}
