/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/unbound-method */
import { AnnotationFeatureI } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import { Theme, alpha } from '@mui/material'

import { LinearApolloDisplay } from '../stateModel'
import { MousePosition } from '../stateModel/mouseEvents'
import { CanvasMouseEvent } from '../types'
import { Glyph } from './Glyph'

export class BoxGlyph extends Glyph {
  getRowCount(_feature: AnnotationFeatureI) {
    return 1
  }

  protected getIsSelectedFeature(
    feature: AnnotationFeatureI,
    selectedFeature: AnnotationFeatureI | undefined,
  ) {
    return Boolean(selectedFeature && feature._id === selectedFeature._id)
  }

  protected getBackgroundColor(theme: Theme | undefined, selected: boolean) {
    return selected
      ? theme?.palette.text.primary ?? 'black'
      : theme?.palette.background.default ?? 'white'
  }

  protected getTextColor(theme: Theme | undefined, selected: boolean) {
    return selected
      ? theme?.palette.getContrastText(
          this.getBackgroundColor(theme, selected),
        ) ?? 'white'
      : theme?.palette.text.primary ?? 'black'
  }

  protected drawBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) {
    ctx.fillStyle = color
    ctx.fillRect(x, y, width, height)
  }

  protected drawBoxOutline(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) {
    this.drawBox(ctx, x, y, width, height, color)
    ctx.clearRect(x + 1, y + 1, width - 2, height - 2)
  }

  protected drawBoxFill(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) {
    this.drawBox(ctx, x + 1, y + 1, width - 2, height - 2, color)
  }

  protected drawBoxText(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    color: string,
    text: string,
  ) {
    ctx.fillStyle = color
    const textStart = Math.max(x + 1, 0)
    const textWidth = x - 1 + width - textStart
    ctx.fillText(text, textStart, y + 11, textWidth)
  }

  draw(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeatureI,
    xOffset: number,
    row: number,
    reversed: boolean,
  ) {
    const { apolloRowHeight: heightPx, lgv, session, theme } = stateModel
    const { bpPerPx } = lgv
    const { apolloSelectedFeature } = session
    const offsetPx = (feature.start - feature.min) / bpPerPx
    const widthPx = feature.length / bpPerPx
    const startPx = reversed ? xOffset - offsetPx - widthPx : xOffset + offsetPx
    const top = row * heightPx
    const isSelected = this.getIsSelectedFeature(feature, apolloSelectedFeature)
    const backgroundColor = this.getBackgroundColor(theme, isSelected)
    const textColor = this.getTextColor(theme, isSelected)
    const groupingColor = isSelected
      ? 'rgba(130,0,0,0.45)'
      : 'rgba(255,0,0,0.25)'
    const featureBox: [number, number, number, number] = [
      startPx,
      top,
      widthPx,
      heightPx,
    ]
    this.drawBoxOutline(ctx, ...featureBox, textColor)
    if (widthPx <= 2) {
      // Don't need to add details if the feature is too small to see them
      return
    }

    let featureLocations: { start: number; end: number; type: string }[] = [
      feature,
    ]
    if (
      feature.discontinuousLocations &&
      feature.discontinuousLocations.length > 0
    ) {
      featureLocations = feature.discontinuousLocations.map((f) => ({
        start: f.start,
        end: f.end,
        type: feature.type,
      }))
    }
    if (featureLocations.length > 1) {
      this.drawBoxFill(ctx, ...featureBox, groupingColor)
      for (const location of featureLocations) {
        const offsetPx = (location.start - feature.min) / bpPerPx
        const widthPx = (location.end - location.start) / bpPerPx
        const startPx = reversed
          ? xOffset - offsetPx - widthPx
          : xOffset + offsetPx
        this.drawBoxOutline(ctx, startPx, top, widthPx, heightPx, textColor)
      }
    }

    for (const location of featureLocations) {
      const offsetPx = (location.start - feature.min) / bpPerPx
      const widthPx = (location.end - location.start) / bpPerPx
      const startPx = reversed
        ? xOffset - offsetPx - widthPx
        : xOffset + offsetPx
      this.drawBoxFill(ctx, startPx, top, widthPx, heightPx, backgroundColor)
      this.drawBoxText(ctx, startPx, top, widthPx, textColor, location.type)
    }
  }

  getFeatureFromLayout(
    feature: AnnotationFeatureI,
    _bp: number,
    _row: number,
  ): AnnotationFeatureI | undefined {
    return feature
  }

  getRowForFeature(
    _feature: AnnotationFeatureI,
    _childFeature: AnnotationFeatureI,
  ): number | undefined {
    return 0
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
    const { refName, regionNumber, x } = mousePosition
    const { lgv } = stateModel
    const { bpToPx, offsetPx } = lgv
    const startPxInfo = bpToPx({ refName, coord: feature.start, regionNumber })
    const endPxInfo = bpToPx({ refName, coord: feature.end, regionNumber })
    if (startPxInfo !== undefined && endPxInfo !== undefined) {
      const startPx = startPxInfo.offsetPx - offsetPx
      const endPx = endPxInfo.offsetPx - offsetPx
      if (Math.abs(endPx - startPx) < 8) {
        return
      }
      if (Math.abs(startPx - x) < 4) {
        return 'start'
      }
      if (Math.abs(endPx - x) < 4) {
        return 'end'
      }
    }
    return
  }

  drawHover(stateModel: LinearApolloDisplay, ctx: CanvasRenderingContext2D) {
    const { apolloHover, apolloRowHeight, displayedRegions, lgv, theme } =
      stateModel
    if (!apolloHover) {
      return
    }
    const { feature, mousePosition } = apolloHover
    if (!feature || !mousePosition) {
      return
    }
    const { bpPerPx, bpToPx, offsetPx } = lgv
    const displayedRegion = displayedRegions[mousePosition.regionNumber]
    const { refName, reversed } = displayedRegion
    const { end, length, start } = feature
    const { regionNumber, y } = mousePosition
    const startPx =
      (bpToPx({ refName, coord: reversed ? end : start, regionNumber })
        ?.offsetPx ?? 0) - offsetPx
    const row = Math.floor(y / apolloRowHeight)
    const top = row * apolloRowHeight
    const widthPx = length / bpPerPx
    ctx.fillStyle = theme?.palette.action.focus ?? 'rgba(0,0,0,0.04)'
    ctx.fillRect(startPx, top, widthPx, apolloRowHeight)
  }

  drawDragPreview(
    stateModel: LinearApolloDisplay,
    overlayCtx: CanvasRenderingContext2D,
  ) {
    const { apolloDragging, apolloRowHeight, displayedRegions, lgv, theme } =
      stateModel
    const { bpPerPx, offsetPx } = lgv
    if (!apolloDragging) {
      return
    }
    const {
      feature,
      glyph,
      mousePosition: startingMousePosition,
    } = apolloDragging.start
    if (!feature) {
      throw new Error('no feature for drag preview??')
    }
    if (glyph !== this) {
      throw new Error('drawDragPreview() called on wrong glyph?')
    }
    const { mousePosition: currentMousePosition } = apolloDragging.current
    const edge = this.isMouseOnFeatureEdge(
      startingMousePosition,
      feature,
      stateModel,
    )
    if (!edge) {
      return
    }

    const row = Math.floor(startingMousePosition.y / apolloRowHeight)
    const region = displayedRegions[startingMousePosition.regionNumber]
    const rowCount = this.getRowCount(feature)

    const featureEdgeBp = region.reversed
      ? region.end - feature[edge]
      : feature[edge] - region.start
    const featureEdgePx = featureEdgeBp / bpPerPx - offsetPx

    const rectX = Math.min(currentMousePosition.x, featureEdgePx)
    const rectY = row * apolloRowHeight
    const rectWidth = Math.abs(currentMousePosition.x - featureEdgePx)
    const rectHeight = apolloRowHeight * rowCount

    overlayCtx.strokeStyle = theme?.palette.info.main ?? 'rgb(255,0,0)'
    overlayCtx.setLineDash([6])
    overlayCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
    overlayCtx.fillStyle = alpha(
      theme?.palette.info.main ?? 'rgb(255,0,0)',
      0.2,
    )
    overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight)
  }

  onMouseMove(stateModel: LinearApolloDisplay, event: CanvasMouseEvent) {
    const { feature, mousePosition } =
      stateModel.getFeatureAndGlyphUnderMouse(event)
    if (stateModel.apolloDragging) {
      stateModel.setCursor('col-resize')
      return
    }
    if (feature && mousePosition) {
      const edge = this.isMouseOnFeatureEdge(mousePosition, feature, stateModel)
      if (edge) {
        stateModel.setCursor('col-resize')
      } else {
        stateModel.setCursor()
      }
    }
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

  onMouseUp(stateModel: LinearApolloDisplay, event: CanvasMouseEvent) {
    if (stateModel.apolloDragging ?? event.button !== 0) {
      return
    }
    const { feature } = stateModel.getFeatureAndGlyphUnderMouse(event)
    if (feature) {
      stateModel.setSelectedFeature(feature)
    }
  }

  startDrag(stateModel: LinearApolloDisplay): boolean {
    // only accept the drag if we are on the edge of the feature
    const { feature, mousePosition } = stateModel.apolloDragging?.start ?? {}
    if (feature && mousePosition) {
      const edge = this.isMouseOnFeatureEdge(mousePosition, feature, stateModel)
      if (edge) {
        return true
      }
    }
    return false
  }

  continueDrag(
    stateModel: LinearApolloDisplay,
    currentMousePosition: MousePosition,
  ) {
    const { feature, glyph, mousePosition, topLevelFeature } =
      stateModel.apolloDragging?.start ?? {}
    if (!(currentMousePosition && mousePosition)) {
      return
    }
    stateModel.setDragging({
      start: {
        feature,
        topLevelFeature,
        glyph,
        mousePosition,
      },
      current: {
        feature,
        topLevelFeature,
        glyph,
        mousePosition: currentMousePosition,
      },
    })
  }

  executeDrag(stateModel: LinearApolloDisplay) {
    const {
      apolloDragging,
      changeManager,
      displayedRegions,
      getAssemblyId,
      setCursor,
    } = stateModel
    if (!apolloDragging) {
      return
    }
    const {
      feature,
      glyph,
      mousePosition: startingMousePosition,
    } = apolloDragging.start
    if (!feature) {
      throw new Error('no feature for drag preview??')
    }
    if (glyph !== this) {
      throw new Error('drawDragPreview() called on wrong glyph?')
    }
    const edge = this.isMouseOnFeatureEdge(
      startingMousePosition,
      feature,
      stateModel,
    )
    if (!edge) {
      return
    }

    const { mousePosition: currentMousePosition } = apolloDragging.current
    const region = displayedRegions[startingMousePosition.regionNumber]
    const newBp = currentMousePosition.bp
    const assembly = getAssemblyId(region.assemblyName)
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
    if (!changeManager) {
      throw new Error('no change manager')
    }
    void changeManager.submit(change)
    setCursor()
  }
}
