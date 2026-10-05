import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { ComponentType } from 'react'

import type { Change } from '../Change.js'
import type { ChangeRule } from '../ChangeRule.js'
import type { Check } from '../Check.js'

import type { ClientChangeType } from './ClientChangeType.js'
import type { ClientValidation } from './ClientValidation.js'
import type { BuiltInGlyphs, Glyph } from './Glyph.js'

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
  /**
   * Validate a change, apply it in the client and send it to the server, the
   * same way Apollo submits its own changes
   */
  submitChange(change: Change): Promise<void>
}

/**
 * Props for custom components added to the feature and transcript details
 * widgets with the `Apollo-FeatureDetailsCustomComponent-*` and
 * `Apollo-TranscriptDetailsCustomComponent-*` extension points
 */
export interface DetailsWidgetCustomComponentProps {
  session: AbstractSessionModel
  feature: AnnotationFeature
  /**
   * Validate a change, apply it in the client and send it to the server, the
   * same way Apollo submits its own changes
   */
  submitChange(change: Change): Promise<void>
}

/** Props for an `Apollo-AttributeEditorComponent` component */
export interface AttributeEditorProps {
  session: AbstractSessionModel
  /** The current values of the attribute, if it has any */
  attributeValues?: string[]
  /** Set new values, or call with nothing to cancel editing */
  setAttribute: (newAttribute?: string[]) => void
  /** Whether this is a new attribute being added */
  isNew?: boolean
}

/** Props for an `Apollo-AttributeViewerComponent` component */
export interface AttributeViewerProps {
  values: string[] | undefined
}

/** The slots in the feature details widget */
export type FeatureDetailsSlot =
  | 'AfterBasicInformation'
  | 'InsideAttributes'
  | 'AfterAttributes'
  | 'InsideSequence'
  | 'AfterSequence'
  | 'InsideRelatedFeatures'
  | 'AfterRelatedFeatures'

/** The slots in the transcript details widget */
export type TranscriptDetailsSlot =
  | 'InsideSummary'
  | 'AfterSummary'
  | 'InsideLocation'
  | 'AfterLocation'
  | 'InsideAttributes'
  | 'AfterAttributes'
  | 'InsideSequence'
  | 'AfterSequence'

type DetailsWidgetSlot = ComponentType<DetailsWidgetCustomComponentProps>

interface DetailsWidgetSlotPoint {
  args: DetailsWidgetSlot
  result: DetailsWidgetSlot
  props: DetailsWidgetCustomComponentProps
}

type DetailsWidgetExtensionPoints = {
  [Slot in FeatureDetailsSlot as `Apollo-FeatureDetailsCustomComponent-${Slot}`]: DetailsWidgetSlotPoint
} & {
  [Slot in TranscriptDetailsSlot as `Apollo-TranscriptDetailsCustomComponent-${Slot}`]: DetailsWidgetSlotPoint
}

/**
 * Every extension point the Apollo JBrowse plugin evaluates. Each one is
 * added to JBrowse's `ExtensionPointRegistry`, so callbacks registered with
 * `pluginManager.addToExtensionPoint` (or, for the points that collect a
 * list, `pluginManager.contributeToExtensionPoint`) are type-checked once
 * anything is imported from `@apollo-annotation/common/client`.
 */
export interface ApolloClientExtensionPoints {
  /**
   * Change types this plugin adds, keyed by `typeName`. Evaluated when
   * Apollo is configured.
   */
  'Apollo-RegisterChangeTypes': {
    args: Record<string, ClientChangeType>
    result: Record<string, ClientChangeType>
  }
  /**
   * Checks this plugin adds; register with `contributeToExtensionPoint`.
   * Evaluated when Apollo is configured.
   */
  'Apollo-RegisterChecks': { args: Check[]; result: Check[] }
  /**
   * Change rules and client validations this plugin adds; register with
   * `contributeToExtensionPoint`. Evaluated when Apollo is configured.
   */
  'Apollo-RegisterValidations': {
    args: (ChangeRule | ClientValidation)[]
    result: (ChangeRule | ClientValidation)[]
  }
  /** The glyph used to draw a feature in the linear annotation display */
  'Apollo-GetGlyph': { args: Glyph; result: Glyph; props: GetGlyphProps }
  /**
   * Extra context menu items for a feature; register with
   * `contributeToExtensionPoint`
   */
  'Apollo-FeatureContextMenuItems': {
    args: MenuItem[]
    result: MenuItem[]
    props: FeatureContextMenuItemsProps
  }
  /**
   * Attribute keys offered when adding an attribute, as a map of display
   * label to attribute key. Return a new object rather than changing the one
   * you're given.
   */
  'Apollo-ReservedAttributeKeys': {
    args: Record<string, string | undefined>
    result: Record<string, string | undefined>
  }
  /**
   * The component used to edit an attribute. `key` is undefined when adding
   * a new attribute.
   */
  'Apollo-AttributeEditorComponent': {
    args: ComponentType<AttributeEditorProps>
    result: ComponentType<AttributeEditorProps>
    props: { key?: string }
  }
  /** The component used to show an attribute's values */
  'Apollo-AttributeViewerComponent': {
    args: ComponentType<AttributeViewerProps>
    result: ComponentType<AttributeViewerProps>
    props: { key: string }
  }
}

type AllApolloClientExtensionPoints = ApolloClientExtensionPoints &
  DetailsWidgetExtensionPoints

declare module '@jbrowse/core/PluginManager' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ExtensionPointRegistry extends AllApolloClientExtensionPoints {}
}
