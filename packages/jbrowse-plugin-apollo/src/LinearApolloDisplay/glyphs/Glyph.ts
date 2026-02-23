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
  drawDragPreview(
    display: LinearApolloDisplayMouseEvents,
    ctx: CanvasRenderingContext2D,
  ): void

  /** @returns number of layout rows used by this glyph with this feature and zoom level */
  getRowCount(
    display: LinearApolloDisplayMouseEvents,
    feature: AnnotationFeature,
  ): number
  /**
   * @returns the feature or subfeature at the given bp and row number in this
   * glyph's layout, or undefined if one does not exist
   */
  getFeatureFromLayout(
    display: LinearApolloDisplay,
    feature: AnnotationFeature,
    bp: number,
    row: number,
  ): AnnotationFeature | undefined
  /**
   * @returns the row in this glyph where a child feature appears, or undefined
   * if the feature does not appear
   */
  getRowForFeature(
    display: LinearApolloDisplay,
    feature: AnnotationFeature,
    childFeature: AnnotationFeature,
  ): number | undefined

  onMouseDown(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void

  onMouseMove(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void

  onMouseLeave(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void

  onMouseUp(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void

  drawTooltip(
    display: LinearApolloDisplayMouseEvents,
    context: CanvasRenderingContext2D,
  ): void

  getContextMenuItemsForFeature(
    display: LinearApolloDisplayMouseEvents,
    sourceFeature: AnnotationFeature,
  ): MenuItem[]

  getContextMenuItems(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
  ): MenuItem[]
}
