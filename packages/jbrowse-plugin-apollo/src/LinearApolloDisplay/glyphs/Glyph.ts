import { MenuItem } from '@jbrowse/core/ui'
import { AnnotationFeatureI } from 'apollo-mst'

import { Coord } from '../components'
import { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import { LinearApolloDisplayRendering } from '../stateModel/rendering'
import { CanvasMouseEvent } from '../types'

export abstract class Glyph {
  /** @returns number of layout rows used by this glyph with this feature and zoom level */
  abstract getRowCount(feature: AnnotationFeatureI, bpPerPx: number): number

  /** draw the feature's primary rendering on the canvas */
  abstract draw(
    display: LinearApolloDisplayRendering,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeatureI,
    x: number,
    y: number,
    reversed: boolean,
  ): void

  /** @returns the feature or subfeature at the given bp and row number in this glyph's layout */
  abstract getFeatureFromLayout(
    feature: AnnotationFeatureI,
    bp: number,
    row: number,
  ): AnnotationFeatureI | undefined

  drawHover(
    display: LinearApolloDisplayMouseEvents,
    overlayCtx: CanvasRenderingContext2D,
  ) {
    return
  }

  drawDragPreview(
    display: LinearApolloDisplayMouseEvents,
    ctx: CanvasRenderingContext2D,
  ) {
    return
  }

  /** @returns true if the current drag that is starting is valid */
  startDrag(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): boolean {
    return false
  }

  executeDrag(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseDown(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseMove(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseLeave(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseUp(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onContextMenu(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  getContextMenuItems(
    display: LinearApolloDisplayMouseEvents,
    contextCoord: Coord,
  ): MenuItem[] {
    return []
  }
}
