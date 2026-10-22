/// <reference lib="dom" />
import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

interface LayoutFeature {
  feature: AnnotationFeature
  rowInFeature: number
}
export type LayoutRow = LayoutFeature[]

/** How a feature and its children are laid out in rows */
export interface Layout {
  byFeature: Map<string, number>
  byRow: LayoutRow[]
  min: number
  max: number
}

export type OverlayType = 'hover' | 'select' | 'highlight'

/**
 * Draws a feature (and usually its children) in an Apollo annotation display.
 * `Display` is the display's state model, which glyphs use for e.g. the
 * theme, the selected feature and coordinate conversion.
 */
export interface Glyph<Display = unknown> {
  /** draw the feature's primary rendering on the canvas */
  draw(
    display: Display,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    rowInFeature: number,
    block: ContentBlock,
  ): void
  /**
   * draw an overlay of the feature, used for when the feature is selected,
   * hovered over, or highlighted
   */
  drawOverlay(
    display: Display,
    overlayCtx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    block: ContentBlock,
    overlayType: OverlayType,
    rowInFeature?: number,
  ): void
  /** draw a preview of the result of a dragging action on the overlay canvas */
  drawDragPreview(
    display: Display,
    overlayCtx: CanvasRenderingContext2D,
    feature: AnnotationFeature,
    row: number,
    block: ContentBlock,
  ): void

  getLayout(display: Display, feature: AnnotationFeature): Layout

  getContextMenuItems(display: Display, feature: AnnotationFeature): MenuItem[]

  isDraggable: boolean
}

/** The glyphs Apollo uses by default, for reuse by plugins */
export interface BuiltInGlyphs<Display = unknown> {
  box: Glyph<Display>
  gene: Glyph<Display>
  transcript: Glyph<Display>
  exon: Glyph<Display>
  cds: Glyph<Display>
  genericChild: Glyph<Display>
}
