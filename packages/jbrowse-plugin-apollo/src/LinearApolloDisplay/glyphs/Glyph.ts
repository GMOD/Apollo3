import { AnnotationFeatureI } from 'apollo-mst'

import { LinearApolloDisplay } from '../stateModel'
import { CanvasMouseEvent } from '../types'

export interface DisplayState {
  setDragging(dragInfo?: {
    edge: 'start' | 'end'
    feature: AnnotationFeatureI
    x: number
    y: number
    regionIndex: number
  }): void
}

export abstract class Glyph {
  /** @returns number of layout rows used by this glyph with this feature and zoom level */
  abstract getRowCount(feature: AnnotationFeatureI, bpPerPx: number): number

  /** draw the feature's primary rendering on the canvas */
  abstract draw(
    feature: AnnotationFeatureI,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    bpPerPx: number,
    rowHeight: number,
    reversed?: boolean,
  ): void

  /** @returns the feature or subfeature at the given bp and row number in this glyph's layout */
  abstract getFeatureFromLayout(
    feature: AnnotationFeatureI,
    bp: number,
    row: number,
  ): AnnotationFeatureI | undefined

  drawHover(
    stateModel: LinearApolloDisplay,
    overlayCtx: CanvasRenderingContext2D,
  ) {
    return
  }

  drawDragPreview(
    displayState: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
  ) {
    return
  }

  /** @returns true if the current drag that is starting is valid */
  startDrag(
    displayState: LinearApolloDisplay,
    event: CanvasMouseEvent,
  ): boolean {
    return false
  }

  executeDrag(
    displayState: LinearApolloDisplay,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseDown(
    displayState: LinearApolloDisplay,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseMove(
    displayState: LinearApolloDisplay,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseLeave(
    displayState: LinearApolloDisplay,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseUp(displayState: LinearApolloDisplay, event: CanvasMouseEvent): void {
    return
  }

  onContextMenu(event: CanvasMouseEvent, displayState: DisplayState): void {
    event.preventDefault()
  }
}
