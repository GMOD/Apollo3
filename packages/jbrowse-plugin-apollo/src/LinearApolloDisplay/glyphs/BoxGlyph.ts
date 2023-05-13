import { AnnotationFeatureI } from 'apollo-mst'
import { LocationEndChange, LocationStartChange } from 'apollo-shared'

import { LinearApolloDisplay } from '../stateModel'
import { MousePosition } from '../stateModel/mouse-events'
import { CanvasMouseEvent } from '../types'
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

  drawHover(stateModel: LinearApolloDisplay, ctx: CanvasRenderingContext2D) {
    const hover = stateModel.apolloHover
    if (!hover) {
      return
    }
    const { feature, mousePosition } = hover
    if (!feature) {
      return
    }
    const { bpPerPx } = stateModel.lgv
    const rowHeight = stateModel.apolloRowHeight
    const displayedRegion =
      stateModel.displayedRegions[mousePosition.regionNumber]

    const x =
      (stateModel.lgv.bpToPx({
        refName: displayedRegion.refName,
        coord: feature.min,
        regionNumber: mousePosition.regionNumber,
      })?.offsetPx || 0) - stateModel.lgv.offsetPx
    const row = Math.floor(mousePosition.y / rowHeight)
    const y = row * rowHeight

    const width = feature.end - feature.start
    const widthPx = width / bpPerPx
    const startBp = displayedRegion.reversed
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

  drawDragPreview(
    stateModel: LinearApolloDisplay,
    overlayCtx: CanvasRenderingContext2D,
  ) {
    const { apolloDragging: dragging } = stateModel
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

    const row = Math.floor(startingMousePosition.y / stateModel.apolloRowHeight)
    const region =
      stateModel.displayedRegions[startingMousePosition.regionNumber]
    const rowCount = this.getRowCount(feature, stateModel.lgv.bpPerPx)

    const featureEdgeBp = region.reversed
      ? region.end - feature[edge]
      : feature[edge] - region.start
    const featureEdgePx =
      featureEdgeBp / stateModel.lgv.bpPerPx - stateModel.lgv.offsetPx

    const rectX = Math.min(currentMousePosition.x, featureEdgePx)
    const rectY = row * stateModel.apolloRowHeight
    const rectWidth = Math.abs(currentMousePosition.x - featureEdgePx)
    const rectHeight = stateModel.apolloRowHeight * rowCount

    overlayCtx.strokeStyle = 'red'
    overlayCtx.setLineDash([6])
    overlayCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
    overlayCtx.fillStyle = 'rgba(255,0,0,.2)'
    overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight)
  }

  onMouseDown(stateModel: LinearApolloDisplay, event: CanvasMouseEvent) {
    // swallow the mouseDown if we are on the edge of the feature
    const { feature, mousePosition } =
      stateModel.getFeatureAndGlyphUnderMouse(event)
    if (feature && mousePosition) {
      const edge = this.isMouseOnFeatureEdge(mousePosition, feature, stateModel)
      if (edge) {
        event.stopPropagation()
      }
    }
  }

  startDrag(stateModel: LinearApolloDisplay, event: CanvasMouseEvent): boolean {
    // only accept the drag if we are on the edge of the feature
    const { mousePosition, feature } = stateModel.apolloDragging?.start || {}
    if (feature && mousePosition) {
      const edge = this.isMouseOnFeatureEdge(mousePosition, feature, stateModel)
      if (edge) {
        return true
      }
    }
    return false
  }

  executeDrag(stateModel: LinearApolloDisplay) {
    const { apolloDragging: dragging } = stateModel
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

    const region =
      stateModel.displayedRegions[startingMousePosition.regionNumber]
    const featureEdgeBp = region.reversed
      ? region.end - feature[edge]
      : feature[edge] - region.start
    const featureEdgePx =
      featureEdgeBp / stateModel.lgv.bpPerPx - stateModel.lgv.offsetPx

    const newBp = Math.round(
      featureEdgeBp +
        (currentMousePosition.x - featureEdgePx) * stateModel.lgv.bpPerPx,
    )
    const assembly = stateModel.getAssemblyId(region.assemblyName)
    let change: LocationEndChange | LocationStartChange
    if (edge === 'end') {
      const featureId = feature._id
      const oldEnd = feature.end
      const newEnd = newBp
      change = new LocationEndChange({
        typeName: 'LocationEndChange',
        changedIds: [featureId],
        featureId,
        oldEnd,
        newEnd,
        assembly,
      })
    } else {
      const featureId = feature._id
      const oldStart = feature.start
      const newStart = newBp
      change = new LocationStartChange({
        typeName: 'LocationStartChange',
        changedIds: [featureId],
        featureId,
        oldStart,
        newStart,
        assembly,
      })
    }
    if (!stateModel.changeManager) {
      throw new Error('no change manager')
    }
    stateModel.changeManager.submit(change)
  }
}
