import { AnnotationFeature } from '@apollo-annotation/mst'
import { MenuItem } from '@jbrowse/core/ui'

import {
  LinearApolloSixFrameDisplayMouseEvents,
  MousePositionWithFeatureAndGlyph,
} from '../stateModel/mouseEvents'
import { LinearApolloSixFrameDisplayRendering } from '../stateModel/rendering'
import { CanvasMouseEvent } from '../types'
import { OntologyRecord } from '../../OntologyManager'

export interface Glyph {
  /** @returns number of layout rows used by this glyph with this feature and zoom level */
  getRowCount(feature: AnnotationFeature, bpPerPx: number): number
  /** draw the feature's primary rendering on the canvas */
  draw(
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    stateModel: LinearApolloSixFrameDisplayRendering,
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
  ): number | undefined

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
