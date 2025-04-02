import { AnnotationFeature } from '@apollo-annotation/mst'
import { MenuItem } from '@jbrowse/core/ui'

import {
  LinearApolloSixFrameDisplayMouseEvents,
  MousePositionWithFeatureAndGlyph,
} from '../stateModel/mouseEvents'
import { LinearApolloSixFrameDisplayRendering } from '../stateModel/rendering'
import { CanvasMouseEvent } from '../types'

export interface Glyph {
  /** draw the feature's primary rendering on the canvas */
  draw(
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    stateModel: LinearApolloSixFrameDisplayRendering,
    displayedRegionIndex: number,
  ): void

  drawHover(
    display: LinearApolloSixFrameDisplayMouseEvents,
    overlayCtx: CanvasRenderingContext2D,
  ): void

  drawDragPreview(
    display: LinearApolloSixFrameDisplayMouseEvents,
    ctx: CanvasRenderingContext2D,
  ): void

  onMouseDown(
    display: LinearApolloSixFrameDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeatureAndGlyph,
    event: CanvasMouseEvent,
  ): void

  onMouseMove(
    display: LinearApolloSixFrameDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeatureAndGlyph,
    event: CanvasMouseEvent,
  ): void

  onMouseLeave(
    display: LinearApolloSixFrameDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeatureAndGlyph,
    event: CanvasMouseEvent,
  ): void

  onMouseUp(
    display: LinearApolloSixFrameDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeatureAndGlyph,
    event: CanvasMouseEvent,
  ): void

  drawTooltip(
    display: LinearApolloSixFrameDisplayMouseEvents,
    context: CanvasRenderingContext2D,
  ): void

  getContextMenuItems(
    display: LinearApolloSixFrameDisplayMouseEvents,
  ): MenuItem[]
}
