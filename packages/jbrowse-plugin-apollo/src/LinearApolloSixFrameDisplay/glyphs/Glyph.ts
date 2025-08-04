import { type AnnotationFeature } from '@apollo-annotation/mst'
import { type MenuItem } from '@jbrowse/core/ui'

import { type MousePositionWithFeature } from '../../util'
import { type LinearApolloSixFrameDisplayMouseEvents } from '../stateModel/mouseEvents'
import { type LinearApolloSixFrameDisplayRendering } from '../stateModel/rendering'
import { type CanvasMouseEvent } from '../types'

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
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void

  onMouseMove(
    display: LinearApolloSixFrameDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void

  onMouseLeave(
    display: LinearApolloSixFrameDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void

  onMouseUp(
    display: LinearApolloSixFrameDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void

  drawTooltip(
    display: LinearApolloSixFrameDisplayMouseEvents,
    context: CanvasRenderingContext2D,
  ): void

  getContextMenuItemsForFeature(
    display: LinearApolloSixFrameDisplayMouseEvents,
    sourceFeature: AnnotationFeature,
  ): MenuItem[]

  getContextMenuItems(
    display: LinearApolloSixFrameDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
  ): MenuItem[]
}
