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

  drawDragPreview(
    displayState: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
  ) {
    return
  }

  executeDrag(displayState: LinearApolloDisplay, event: CanvasMouseEvent) {
    return
  }

  onMouseMove(event: CanvasMouseEvent, displayState: DisplayState): void {
    return
  }

  onMouseLeave(event: CanvasMouseEvent, displayState: DisplayState): void {
    return
  }

  onMouseDown(event: CanvasMouseEvent, displayState: DisplayState): void {
    return
  }

  onMouseUp(event: CanvasMouseEvent, displayState: DisplayState): void {
    return
  }

  onContextMenu(event: CanvasMouseEvent, displayState: DisplayState) {
    event.preventDefault()
  }
}
