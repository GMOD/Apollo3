import { AnnotationFeature } from '@apollo-annotation/mst'
import { MenuItem } from '@jbrowse/core/ui'

import {
  LinearApolloDisplayMouseEvents,
  MousePositionWithFeatureAndGlyph,
} from '../stateModel/mouseEvents'
import { LinearApolloDisplayRendering } from '../stateModel/rendering'
import { CanvasMouseEvent } from '../types'

export interface Glyph {
  /** @returns number of layout rows used by this glyph with this feature and zoom level */
  getRowCount(feature: AnnotationFeature, bpPerPx: number): number
  /** draw the feature's primary rendering on the canvas */
  draw(
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    stateModel: LinearApolloDisplayRendering,
    displayedRegionIndex: number,
  ): Promise<void>
  /** @returns the feature or subfeature at the given bp and row number in this glyph's layout */
  getFeatureFromLayout(
    feature: AnnotationFeature,
    bp: number,
    row: number,
    stateModel: LinearApolloDisplayRendering,
  ): Promise<AnnotationFeature | undefined>
  getRowForFeature(
    feature: AnnotationFeature,
    childFeature: AnnotationFeature,
    stateModel: LinearApolloDisplayRendering,
  ): Promise<number | undefined>

  drawHover(
    display: LinearApolloDisplayMouseEvents,
    overlayCtx: CanvasRenderingContext2D,
  ): Promise<void>

  drawDragPreview(
    display: LinearApolloDisplayMouseEvents,
    ctx: CanvasRenderingContext2D,
  ): void

  onMouseDown(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeatureAndGlyph,
    event: CanvasMouseEvent,
  ): Promise<void>

  onMouseMove(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeatureAndGlyph,
    event: CanvasMouseEvent,
  ): Promise<void>

  onMouseLeave(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeatureAndGlyph,
    event: CanvasMouseEvent,
  ): void

  onMouseUp(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeatureAndGlyph,
    event: CanvasMouseEvent,
  ): void

  drawTooltip(
    display: LinearApolloDisplayMouseEvents,
    context: CanvasRenderingContext2D,
    stateModel: LinearApolloDisplayRendering,
  ): Promise<void>

  getContextMenuItems(display: LinearApolloDisplayMouseEvents): MenuItem[]
}
