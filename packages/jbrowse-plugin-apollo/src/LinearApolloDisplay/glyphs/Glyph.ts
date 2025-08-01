import { type AnnotationFeature } from '@apollo-annotation/mst'
import { type MenuItem } from '@jbrowse/core/ui'

import { type OntologyRecord } from '../../OntologyManager'
import { type MousePositionWithFeature } from '../../util'
import { type LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import { type LinearApolloDisplayRendering } from '../stateModel/rendering'
import { type CanvasMouseEvent } from '../types'

export interface Glyph {
  /** @returns number of layout rows used by this glyph with this feature and zoom level */
  getRowCount(
    feature: AnnotationFeature,
    featureTypeOntology: OntologyRecord,
    bpPerPx: number,
  ): number
  /** draw the feature's primary rendering on the canvas */
  draw(
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    stateModel: LinearApolloDisplayRendering,
    displayedRegionIndex: number,
  ): void
  /** @returns the feature or subfeature at the given bp and row number in this glyph's layout */
  getFeatureFromLayout(
    feature: AnnotationFeature,
    bp: number,
    row: number,
    featureTypeOntology: OntologyRecord,
  ): AnnotationFeature | undefined
  getRowForFeature(
    feature: AnnotationFeature,
    childFeature: AnnotationFeature,
    featureTypeOntology: OntologyRecord,
  ): number | undefined

  drawHover(
    display: LinearApolloDisplayMouseEvents,
    overlayCtx: CanvasRenderingContext2D,
  ): void

  drawDragPreview(
    display: LinearApolloDisplayMouseEvents,
    ctx: CanvasRenderingContext2D,
  ): void

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
