import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

import type { MousePositionWithFeature } from '../../util'
import type { LinearApolloDisplay } from '../stateModel'
import type { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import type { CanvasMouseEvent } from '../types'

export interface Glyph {
  /** draw the feature's primary rendering on the canvas */
  draw(
    display: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    block: ContentBlock,
  ): void
  /** draw the feature's hover highlight on the overlay canvas */
  drawHover(
    display: LinearApolloDisplay,
    overlayCtx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    block: ContentBlock,
  ): void
  /** draw a preview of the result of a dragging action on the overlay canvas */
  drawDragPreview(
    display: LinearApolloDisplay,
    overlayCtx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    block: ContentBlock,
  ): void

  /** @returns number of layout rows used by this glyph with this feature and zoom level */
  getRowCount(display: LinearApolloDisplay, feature: AnnotationFeature): number
  /**
   * @returns the features at the given bp and row number in this glyph's
   * layout, starting with the one that is considered "on top"
   */
  getFeaturesFromLayout(
    display: LinearApolloDisplay,
    feature: AnnotationFeature,
    bp: number,
    row: number,
  ): AnnotationFeature[]
  /**
   * @returns the row in this glyph where a child feature appears, or undefined
   * if the feature does not appear
   */
  getRowForFeature(
    display: LinearApolloDisplay,
    feature: AnnotationFeature,
    childFeature: AnnotationFeature,
  ): number | undefined

  getContextMenuItemsForFeature(
    display: LinearApolloDisplayMouseEvents,
    sourceFeature: AnnotationFeature,
  ): MenuItem[]

  getContextMenuItems(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
  ): MenuItem[]

  /** take any actions needed when the canvas's onMouseDown event fires */
  onMouseDown(
    display: LinearApolloDisplay,
    mousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void
  /** take any actions needed when the canvas's onMouseMove event fires */
  onMouseMove(
    display: LinearApolloDisplay,
    mousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void
  /** take any actions needed when the canvas's onMouseLeave event fires */
  onMouseLeave(
    display: LinearApolloDisplay,
    mousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void
  /** take any actions needed when the canvas's onMouseUp event fires */
  onMouseUp(
    display: LinearApolloDisplay,
    mousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void
}
