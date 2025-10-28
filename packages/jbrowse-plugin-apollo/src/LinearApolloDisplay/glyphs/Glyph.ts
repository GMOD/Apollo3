import { type AnnotationFeature } from '@apollo-annotation/mst'
import { type MenuItem } from '@jbrowse/core/ui'
import { type ContentBlock } from '@jbrowse/core/util/blockTypes'

import { type OntologyRecord } from '../../OntologyManager'
import { type MousePositionWithFeature } from '../../util'
import { type LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import { type LinearApolloDisplayRendering } from '../stateModel/rendering'
import { type CanvasMouseEvent } from '../types'

export interface Glyph {
  /** draw the feature's primary rendering on the canvas */
  draw(
    display: LinearApolloDisplayRendering,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    block: ContentBlock,
  ): void
  /** draw the feature's hover highlight on the overlay canvas */
  drawHover(
    display: LinearApolloDisplayMouseEvents,
    overlayCtx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    block: ContentBlock,
  ): void
  /** draw the feature's tooltip on the overlay canvas */
  drawTooltip(
    display: LinearApolloDisplayMouseEvents,
    overlayCtx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    block: ContentBlock,
  ): void
  /** draw a preview of the result of a dragging action on the overlay canvas */
  drawDragPreview(
    display: LinearApolloDisplayMouseEvents,
    overlayCtx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    block: ContentBlock,
  ): void

  /** @returns number of layout rows used by this glyph with this feature and zoom level */
  getRowCount(
    feature: AnnotationFeature,
    featureTypeOntology: OntologyRecord,
    bpPerPx: number,
  ): number
  /**
   * @returns the feature or subfeature at the given bp and row number in this
   * glyph's layout, or undefined if one does not exist
   */
  getFeatureFromLayout(
    feature: AnnotationFeature,
    bp: number,
    row: number,
    featureTypeOntology: OntologyRecord,
  ): AnnotationFeature | undefined
  /**
   * @returns the row in this glyph where a child feature appears, or undefined
   * if the feature does not appear
   */
  getRowForFeature(
    feature: AnnotationFeature,
    childFeature: AnnotationFeature,
    featureTypeOntology: OntologyRecord,
  ): number | undefined

  /**
   * @returns the context menu items that should be shown for a given mouse
   * position
   */
  getContextMenuItems(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
  ): MenuItem[]

  /** take any actions needed when the canvas's onMouseDown event fires */
  onMouseDown(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void
  /** take any actions needed when the canvas's onMouseMove event fires */
  onMouseMove(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void
  /** take any actions needed when the canvas's onMouseLeave event fires */
  onMouseLeave(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void
  /** take any actions needed when the canvas's onMouseUp event fires */
  onMouseUp(
    display: LinearApolloDisplayMouseEvents,
    currentMousePosition: MousePositionWithFeature,
    event: CanvasMouseEvent,
  ): void
}
