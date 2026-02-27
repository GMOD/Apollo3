import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

import type { LinearApolloDisplay } from '../stateModel'

interface LayoutFeature {
  feature: AnnotationFeature
  rowInFeature: number
}
export type LayoutRow = LayoutFeature[]

export interface Layout {
  byFeature: Map<string, number>
  byRow: LayoutRow[]
  min: number
  max: number
}

export interface Glyph {
  /** draw the feature's primary rendering on the canvas */
  draw(
    display: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    rowInFeature: number,
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

  getLayout(display: LinearApolloDisplay, feature: AnnotationFeature): Layout

  getContextMenuItems(
    display: LinearApolloDisplay,
    feature: AnnotationFeature,
  ): MenuItem[]

  isDraggable: boolean
}
