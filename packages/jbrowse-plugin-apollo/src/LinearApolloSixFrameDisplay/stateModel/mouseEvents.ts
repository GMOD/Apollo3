import type { AnnotationFeature } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import { getFrame } from '@jbrowse/core/util'
import { type Instance, addDisposer, cast } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'
import type { CSSProperties } from 'react'

import {
  type Edge,
  type MousePosition,
  type MousePositionWithFeature,
  getMousePosition,
  getPropagatedLocationChanges,
  isMousePositionWithFeature,
} from '../../util'
import { extendFeatureContextMenuItems } from '../../util/extendFeatureContextMenuItems'
import { getRowContents } from '../rows'
import type { CanvasMouseEvent } from '../types'

import { renderingModelFactory } from './rendering'

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
    }))
    .views((self) => ({
      getMousePosition(event: React.MouseEvent): MousePosition {
        const mousePosition = getMousePosition(event, self.lgv)
        const { bp, regionNumber, y } = mousePosition
        const row = Math.floor(y / self.apolloRowHeight)
        const rowContents = getRowContents(row, self.showFeatureLabels)
        const region = self.lgv.displayedRegions.at(regionNumber)
        if (!rowContents || !region) {
          return mousePosition
        }
        const { featureTypeOntology } =
          self.session.apolloDataStore.ontologyManager
        if (!featureTypeOntology) {
          throw new Error('featureTypeOntology is undefined')
        }
        const genes = self
          .getGenesInRegion(region)
          .filter((gene) => bp >= gene.min && bp <= gene.max)
        const transcripts = genes.flatMap((gene) =>
          [...(gene.children?.values() ?? [])].filter((child) =>
            featureTypeOntology.isTypeOf(child.type, 'transcript'),
          ),
        )
        let feature: AnnotationFeature | undefined
        if (rowContents.type === 'gene') {
          const { strand } = rowContents
          feature =
            transcripts
              .flatMap((transcript) => [
                ...(transcript.children?.values() ?? []),
              ])
              .find(
                (exon) =>
                  featureTypeOntology.isTypeOf(exon.type, 'exon') &&
                  (exon.strand === 1 ? 1 : -1) === strand &&
                  bp >= exon.min &&
                  bp <= exon.max,
              ) ?? genes.find((gene) => (gene.strand === 1 ? 1 : -1) === strand)
        } else {
          const { frame } = rowContents
          feature = transcripts.find((transcript) => {
            const featureID = transcript.attributes.get('gff_id')?.toString()
            if (featureID && self.filteredTranscripts.includes(featureID)) {
              return false
            }
            return transcript.cdsLocations
              .flat()
              .some(
                (cds) =>
                  bp >= cds.min &&
                  bp <= cds.max &&
                  getFrame(
                    cds.min,
                    cds.max,
                    transcript.strand ?? 1,
                    cds.phase,
                  ) === frame,
              )
          })
        }
        if (!feature) {
          return mousePosition
        }
        return { ...mousePosition, feature }
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
    contextMenuItems(event: React.MouseEvent<HTMLDivElement>): MenuItem[] {
      const { hoveredFeature } = self
      if (!hoveredFeature) {
        return []
      }
      const mousePosition = self.getMousePosition(event)
      const { topLevelFeature } = hoveredFeature.feature
      const glyph = self.getGlyph(topLevelFeature)
      if (isMousePositionWithFeature(mousePosition)) {
        return extendFeatureContextMenuItems(
          pluginManager,
          glyph.getContextMenuItems(self, mousePosition),
          {
            feature: hoveredFeature.feature,
            session: self.session,
            location: 'LinearApolloSixFrameDisplay',
          },
        )
      }
      return []
    },
  }))
    .actions((self) => ({
      // explicitly pass in a feature in case it's not the same as the one in
      // mousePosition (e.g. if features are drawn overlapping).
      startDrag(
        mousePosition: MousePositionWithFeature,
        feature: AnnotationFeature,
        edge: Edge,
        shrinkParent = false,
      ) {
        self.apolloDragging = {
          start: mousePosition,
          current: mousePosition,
          feature,
          edge,
          shrinkParent: shrinkParent as boolean,
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
          self.session,
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
        if (isMousePositionWithFeature(mousePosition)) {
          const glyph = self.getGlyph(mousePosition.feature)
          glyph.onMouseDown(self, mousePosition, event)
        }
      },
      onMouseMove(event: CanvasMouseEvent) {
        const mousePosition = self.getMousePosition(event)
        if (self.apolloDragging) {
          self.setCursor('col-resize')
          self.continueDrag(mousePosition, event)
          return
        }
        if (isMousePositionWithFeature(mousePosition)) {
          const glyph = self.getGlyph(mousePosition.feature)
          glyph.onMouseMove(self, mousePosition, event)
        } else {
          self.setHoveredFeature()
          self.setCursor()
        }
      },
      onMouseLeave(event: CanvasMouseEvent) {
        self.setDragging()
        self.setHoveredFeature()

        const mousePosition = self.getMousePosition(event)
        if (isMousePositionWithFeature(mousePosition)) {
          const glyph = self.getGlyph(mousePosition.feature)
          glyph.onMouseLeave(self, mousePosition, event)
        }
      },
      onMouseUp(event: CanvasMouseEvent) {
        const mousePosition = self.getMousePosition(event)
        if (isMousePositionWithFeature(mousePosition)) {
          const glyph = self.getGlyph(mousePosition.feature)
          glyph.onMouseUp(self, mousePosition, event)
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

              const { apolloDragging, hoveredFeature } = self
              if (!hoveredFeature) {
                return
              }
              const glyph = self.getGlyph(hoveredFeature.feature)

              // draw mouseover hovers
              glyph.drawOverlay(self, ctx)

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
