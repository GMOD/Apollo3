import { AnnotationFeatureI } from 'apollo-mst'

import { LinearApolloDisplay } from '../stateModel'
import { MousePosition } from '../stateModel/mouse-events'
import { Glyph } from './Glyph'

export class BoxGlyph extends Glyph {
  getRowCount(feature: AnnotationFeatureI, bpPerPx: number) {
    return 1
  }

  draw(
    feature: AnnotationFeatureI,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    bpPerPx: number,
    rowHeight: number,
    reversed?: boolean,
  ) {
    const width = feature.end - feature.start
    const widthPx = width / bpPerPx
    const startBp = reversed
      ? feature.max - feature.end
      : feature.start - feature.min
    const startPx = startBp / bpPerPx
    ctx.fillStyle = 'black'
    ctx.fillRect(x + startPx, y, widthPx, rowHeight)
    if (widthPx > 2) {
      ctx.clearRect(x + startPx + 1, y + 1, widthPx - 2, rowHeight - 2)
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fillRect(x + startPx + 1, y + 1, widthPx - 2, rowHeight - 2)
      ctx.fillStyle = 'black'
      feature.type &&
        ctx.fillText(feature.type, x + startPx + 1, y + 11, widthPx - 2)
    }
  }

  getFeatureFromLayout(feature: AnnotationFeatureI, _bp: number, _row: number) {
    return feature
  }

  /** @returns undefined if mouse not on the edge of this feature, otherwise 'start' or 'end' depending on which edge */
  isMouseOnFeatureEdge(
    mousePosition: MousePosition,
    feature: AnnotationFeatureI,
    stateModel: LinearApolloDisplay,
  ) {
    if (!mousePosition) {
      return
    }
    const { x, regionNumber, refName } = mousePosition
    // TODO: check reversed
    // TODO: ensure feature is in interbase
    const startPxInfo = stateModel.lgv.bpToPx({
      refName,
      coord: feature.start,
      regionNumber,
    })
    const endPxInfo = stateModel.lgv.bpToPx({
      refName,
      coord: feature.end,
      regionNumber,
    })
    if (startPxInfo !== undefined && endPxInfo !== undefined) {
      const startPx = startPxInfo.offsetPx - stateModel.lgv.offsetPx
      const endPx = endPxInfo.offsetPx - stateModel.lgv.offsetPx
      if (endPx - startPx < 8) {
        return
      }
      if (Math.abs(startPx - x) < 4) {
        return 'start'
      }
      if (Math.abs(endPx - x) < 4) {
        return 'end'
      }
    }
    return undefined
  }

  drawDragPreview(
    stateModel: LinearApolloDisplay,
    overlayCtx: CanvasRenderingContext2D,
  ) {
    const { dragging } = stateModel
    if (!dragging) {
      return
    }
    const {
      feature,
      glyph,
      mousePosition: startingMousePosition,
    } = dragging.start
    if (!feature) {
      throw new Error('no feature for drag preview??')
    }
    if (glyph !== this) {
      throw new Error('drawDragPreview() called on wrong glyph?')
    }
    const { mousePosition: currentMousePosition } = dragging.current
    const edge = this.isMouseOnFeatureEdge(
      startingMousePosition,
      feature,
      stateModel,
    )
    if (!edge) {
      return
    }

    const { x, y, regionNumber } = currentMousePosition
    const row = Math.floor(y / stateModel.apolloRowHeight)
    const region = stateModel.displayedRegions[regionNumber]
    const rowCount = this.getRowCount(feature, stateModel.lgv.bpPerPx)
    const featureEdge = region.reversed
      ? region.end - feature[edge]
      : feature[edge] - region.start
    const featureEdgePx =
      featureEdge / stateModel.lgv.bpPerPx - stateModel.lgv.offsetPx
    const startPx = Math.min(x, featureEdgePx)
    const widthPx = Math.abs(x - featureEdgePx)
    overlayCtx.strokeStyle = 'red'
    overlayCtx.setLineDash([6])
    overlayCtx.strokeRect(
      startPx,
      row * stateModel.apolloRowHeight,
      widthPx,
      stateModel.apolloRowHeight * rowCount,
    )
    overlayCtx.fillStyle = 'rgba(255,0,0,.2)'
    overlayCtx.fillRect(
      startPx,
      row * stateModel.apolloRowHeight,
      widthPx,
      stateModel.apolloRowHeight * rowCount,
    )
  }

  submitDraggingFeatureEndChange() {
    // const { feature, edge, regionIndex } = self.dragging
    // const bp = feature[edge]
    // const region = self.displayedRegions[regionIndex]
    // const assembly = self.getAssemblyId(region.assemblyName)
    // let change: LocationEndChange | LocationStartChange
    // if (edge === 'end') {
    //   const featureId = feature._id
    //   const oldEnd = feature.end
    //   const newEnd = Math.round(bp)
    //   change = new LocationEndChange({
    //     typeName: 'LocationEndChange',
    //     changedIds: [featureId],
    //     featureId,
    //     oldEnd,
    //     newEnd,
    //     assembly,
    //   })
    // } else {
    //   const featureId = feature._id
    //   const oldStart = feature.start
    //   const newStart = Math.round(bp)
    //   change = new LocationStartChange({
    //     typeName: 'LocationStartChange',
    //     changedIds: [featureId],
    //     featureId,
    //     oldStart,
    //     newStart,
    //     assembly,
    //   })
    // }
    // if (!self.changeManager) {
    //   throw new Error('no change manager')
    // }
    // self.changeManager.submit(change)
  }
}
