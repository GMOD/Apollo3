import {
  type AnnotationFeature,
  type TranscriptPartCoding,
} from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import type PluginManager from '@jbrowse/core/PluginManager'
import { type AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { type MenuItem } from '@jbrowse/core/ui'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { type Instance, addDisposer, cast } from 'mobx-state-tree'
import { type CSSProperties } from 'react'

import { type Edge, getPropagatedLocationChanges } from '../../util'
import { type Coord } from '../components'
import { type Glyph } from '../glyphs/Glyph'
import { type CanvasMouseEvent } from '../types'

import { renderingModelFactory } from './rendering'

export interface FeatureAndGlyphUnderMouse {
  cds: TranscriptPartCoding | null
  feature: AnnotationFeature
  topLevelFeature: AnnotationFeature
  glyph: Glyph
}

/** extended information about the position of the mouse on the canvas, including the refName, bp, and displayedRegion number */
export interface MousePosition {
  x: number
  y: number
  refName: string
  bp: number
  regionNumber: number
  featureAndGlyphUnderMouse?: FeatureAndGlyphUnderMouse
}

export type MousePositionWithFeatureAndGlyph = Required<MousePosition>

export function isMousePositionWithFeatureAndGlyph(
  mousePosition: MousePosition,
): mousePosition is MousePositionWithFeatureAndGlyph {
  return 'featureAndGlyphUnderMouse' in mousePosition
}

function getMousePosition(
  event: CanvasMouseEvent,
  lgv: LinearGenomeViewModel,
): MousePosition {
  const canvas = event.currentTarget
  const { clientX, clientY } = event
  const { left, top } = canvas.getBoundingClientRect()
  const x = clientX - left
  const y = clientY - top
  const { coord: bp, index: regionNumber, refName } = lgv.pxToBp(x)
  return { x, y, refName, bp, regionNumber }
}

export function mouseEventsModelIntermediateFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LinearApolloSixFrameDisplayRendering = renderingModelFactory(
    pluginManager,
    configSchema,
  )

  return LinearApolloSixFrameDisplayRendering.named(
    'LinearApolloSixFrameDisplayMouseEvents',
  )
    .volatile(() => ({
      apolloDragging: null as {
        start: MousePosition
        current: MousePosition
        feature: AnnotationFeature
        edge: Edge
        shrinkParent: boolean
      } | null,
      cursor: undefined as CSSProperties['cursor'] | undefined,
      apolloHover: undefined as FeatureAndGlyphUnderMouse | undefined,
    }))
    .views((self) => ({
      getMousePosition(event: CanvasMouseEvent): MousePosition {
        const mousePosition = getMousePosition(event, self.lgv)
        const { bp, regionNumber, y } = mousePosition
        const row = Math.floor(y / self.apolloRowHeight) + 1
        const featureLayout = self.featureLayouts[regionNumber]
        const layoutRow = featureLayout.get(row)
        if (!layoutRow) {
          return mousePosition
        }
        let foundFeature
        if (self.geneTrackRowNums.includes(row)) {
          foundFeature = layoutRow.find(
            (f) =>
              f.feature.type == 'exon' &&
              bp >= f.feature.min &&
              bp <= f.feature.max,
          )
          if (!foundFeature) {
            foundFeature = layoutRow.find(
              (f) => bp >= f.feature.min && bp <= f.feature.max,
            )
          }
        } else {
          foundFeature = layoutRow.find((f) => {
            const featureID = f.feature.attributes.get('gff_id')?.toString()
            return (
              f.cds != null &&
              bp >= f.cds.min &&
              bp <= f.cds.max &&
              (featureID === undefined ||
                !self.filteredTranscripts.includes(featureID))
            )
          })
        }
        if (!foundFeature) {
          return mousePosition
        }
        const { feature, cds } = foundFeature
        const { topLevelFeature } = feature
        const glyph = self.getGlyph(feature)
        return {
          ...mousePosition,
          featureAndGlyphUnderMouse: { cds, feature, topLevelFeature, glyph },
        }
      },
    }))
    .actions((self) => ({
      continueDrag(mousePosition: MousePosition, event: CanvasMouseEvent) {
        if (!self.apolloDragging) {
          throw new Error(
            'continueDrag() called with no current drag in progress',
          )
        }
        event.stopPropagation()
        self.apolloDragging = { ...self.apolloDragging, current: mousePosition }
      },
      setDragging(dragInfo?: typeof self.apolloDragging) {
        self.apolloDragging = dragInfo ?? null
      },
    }))
    .actions((self) => ({
      setApolloHover(n?: (typeof self)['apolloHover']) {
        self.apolloHover = n
      },
      setCursor(cursor?: CSSProperties['cursor']) {
        if (self.cursor !== cursor) {
          self.cursor = cursor
        }
      },
      updateFilteredTranscripts(forms: string[]): void {
        self.filteredTranscripts = cast(forms)
      },
    }))
    .actions(() => ({
      // onClick(event: CanvasMouseEvent) {
      onClick() {
        // TODO: set the selected feature
      },
    }))
}

export function mouseEventsModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LinearApolloSixFrameDisplayMouseEvents =
    mouseEventsModelIntermediateFactory(pluginManager, configSchema)

  return LinearApolloSixFrameDisplayMouseEvents.views((self) => ({
    contextMenuItems(contextCoord?: Coord): MenuItem[] {
      const { apolloHover } = self
      if (!(apolloHover && contextCoord)) {
        return []
      }
      const { topLevelFeature } = apolloHover
      const glyph = self.getGlyph(topLevelFeature)
      return glyph.getContextMenuItems(self)
    },
  }))
    .actions((self) => ({
      // explicitly pass in a feature in case it's not the same as the one in
      // mousePosition (e.g. if features are drawn overlapping).
      startDrag(
        mousePosition: MousePositionWithFeatureAndGlyph,
        feature: AnnotationFeature,
        edge: Edge,
        shrinkParent = false,
      ) {
        self.apolloDragging = {
          start: mousePosition,
          current: mousePosition,
          feature,
          edge,
          shrinkParent,
        }
      },
      endDrag() {
        if (!self.apolloDragging) {
          throw new Error('endDrag() called with no current drag in progress')
        }
        const { current, edge, feature, start, shrinkParent } =
          self.apolloDragging
        // don't do anything if it was only dragged a tiny bit
        if (Math.abs(current.x - start.x) <= 4) {
          self.setDragging()
          self.setCursor()
          return
        }
        const { displayedRegions } = self.lgv
        const region = displayedRegions[start.regionNumber]
        const assembly = self.getAssemblyId(region.assemblyName)
        const changes = getPropagatedLocationChanges(
          feature,
          current.bp,
          edge,
          shrinkParent,
        )

        const change: LocationEndChange | LocationStartChange =
          edge === 'max'
            ? new LocationEndChange({
                typeName: 'LocationEndChange',
                changedIds: changes.map((c) => c.featureId),
                changes: changes.map((c) => ({
                  featureId: c.featureId,
                  oldEnd: c.oldLocation,
                  newEnd: c.newLocation,
                })),
                assembly,
              })
            : new LocationStartChange({
                typeName: 'LocationStartChange',
                changedIds: changes.map((c) => c.featureId),
                changes: changes.map((c) => ({
                  featureId: c.featureId,
                  oldStart: c.oldLocation,
                  newStart: c.newLocation,
                })),
                assembly,
              })
        void self.changeManager.submit(change)
        self.setDragging()
        self.setCursor()
      },
    }))
    .actions((self) => ({
      onMouseDown(event: CanvasMouseEvent) {
        const mousePosition = self.getMousePosition(event)
        if (isMousePositionWithFeatureAndGlyph(mousePosition)) {
          mousePosition.featureAndGlyphUnderMouse.glyph.onMouseDown(
            self,
            mousePosition,
            event,
          )
        }
      },
      onMouseMove(event: CanvasMouseEvent) {
        const mousePosition = self.getMousePosition(event)
        if (self.apolloDragging) {
          self.setCursor('col-resize')
          self.continueDrag(mousePosition, event)
          return
        }
        if (isMousePositionWithFeatureAndGlyph(mousePosition)) {
          mousePosition.featureAndGlyphUnderMouse.glyph.onMouseMove(
            self,
            mousePosition,
            event,
          )
        } else {
          self.setApolloHover()
          self.setCursor()
        }
      },
      onMouseLeave(event: CanvasMouseEvent) {
        self.setDragging()
        self.setApolloHover()

        const mousePosition = self.getMousePosition(event)
        if (isMousePositionWithFeatureAndGlyph(mousePosition)) {
          mousePosition.featureAndGlyphUnderMouse.glyph.onMouseLeave(
            self,
            mousePosition,
            event,
          )
        }
      },
      onMouseUp(event: CanvasMouseEvent) {
        const mousePosition = self.getMousePosition(event)
        if (isMousePositionWithFeatureAndGlyph(mousePosition)) {
          mousePosition.featureAndGlyphUnderMouse.glyph.onMouseUp(
            self,
            mousePosition,
            event,
          )
        } else {
          self.setSelectedFeature()
        }

        if (self.apolloDragging) {
          self.endDrag()
        }
      },
    }))
    .actions((self) => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              // This type is wrong in @jbrowse/core
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              const ctx = self.overlayCanvas?.getContext('2d')
              if (!ctx) {
                return
              }
              ctx.clearRect(
                0,
                0,
                self.lgv.dynamicBlocks.totalWidthPx,
                self.featuresHeight,
              )

              const { apolloDragging, apolloHover } = self
              if (!apolloHover) {
                return
              }
              const { glyph } = apolloHover

              // draw mouseover hovers
              glyph.drawHover(self, ctx)

              // draw tooltip on hover
              glyph.drawTooltip(self, ctx)

              // dragging previews
              if (apolloDragging) {
                // NOTE: the glyph where the drag started is responsible for drawing the preview.
                // it can call methods in other glyphs to help with this though.
                const glyph = self.getGlyph(
                  apolloDragging.feature.topLevelFeature,
                )
                glyph.drawDragPreview(self, ctx)
              }
            },
            { name: 'LinearApolloSixFrameDisplayRenderMouseoverAndDrag' },
          ),
        )
      },
    }))
}

export type LinearApolloSixFrameDisplayMouseEventsModel = ReturnType<
  typeof mouseEventsModelIntermediateFactory
>
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearApolloSixFrameDisplayMouseEvents
  extends Instance<LinearApolloSixFrameDisplayMouseEventsModel> {}
