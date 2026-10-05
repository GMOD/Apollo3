import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { AbstractSessionModel } from '@jbrowse/core/util'

import type { BuiltInGlyphs } from './Glyph.js'

/** Props for the `Apollo-GetGlyph` extension point */
export interface GetGlyphProps<Display = unknown> {
  /** The feature being drawn */
  feature: AnnotationFeature
  /** The display drawing it */
  display: Display
  /** Apollo's built-in glyphs, to reuse or wrap */
  glyphs: BuiltInGlyphs<Display>
}

/** Where a feature context menu is being shown */
export type FeatureContextMenuLocation =
  | 'LinearApolloDisplay'
  | 'LinearApolloSixFrameDisplay'
  | 'TabularEditor'

/** Props for the `Apollo-FeatureContextMenuItems` extension point */
export interface FeatureContextMenuItemsProps {
  /** The feature the menu is for */
  feature: AnnotationFeature
  session: AbstractSessionModel
  location: FeatureContextMenuLocation
}

/**
 * Props for custom components added to the feature and transcript details
 * widgets with the `Apollo-FeatureDetailsCustomComponent-*` and
 * `Apollo-TranscriptDetailsCustomComponent-*` extension points
 */
export interface DetailsWidgetCustomComponentProps {
  session: AbstractSessionModel
  feature: AnnotationFeature
}
