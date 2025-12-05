import { type AnnotationFeature } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import type PluginManager from '@jbrowse/core/PluginManager'
import { type AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { type MenuItem } from '@jbrowse/core/ui'
import { getFrame } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { type Instance, addDisposer, cast } from 'mobx-state-tree'
import { type CSSProperties } from 'react'

import {
  type Edge,
  type MousePosition,
  type MousePositionWithFeature,
  getMousePosition,
  getPropagatedLocationChanges,
  isMousePositionWithFeature,
} from '../../util'
import { type CanvasMouseEvent } from '../types'

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
        const row = Math.floor(y / self.apolloRowHeight) + 1
        const featureLayout = self.featureLayouts[regionNumber]
        const layoutRow = featureLayout.get(row)
        if (!layoutRow) {
          return mousePosition
        }
        const { featureTypeOntology } =
          self.session.apolloDataStore.ontologyManager
        if (!featureTypeOntology) {
          throw new Error('featureTypeOntology is undefined')
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
            const { feature } = f
            const featureID = feature.featureId?.toString()
            const isTranscript = featureTypeOntology.isTypeOf(
              feature.type,
              'transcript',
            )
            if (!isTranscript) {
              return false
            }
            for (const loc of feature.cdsLocations) {
              for (const cds of loc) {
                let rowNum: number = getFrame(
                  cds.min,
                  cds.max,
                  feature.strand ?? 1,
                  cds.phase,
                )
                rowNum = self.featureLabelSpacer(
                  rowNum < 0 ? -1 * rowNum + 5 : rowNum,
                )
                if (row === rowNum && bp >= cds.min && bp <= cds.max) {
                  return (
                    featureID === undefined ||
                    !self.filteredTranscripts.includes(featureID)
                  )
                }
              }
            }
            return false
          })
        }
        if (!foundFeature) {
          return mousePosition
        }
        const { feature } = foundFeature
        return {
          ...mousePosition,
          feature,
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
        return glyph.getContextMenuItems(self, mousePosition)
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

              const { apolloDragging, hoveredFeature } = self
              if (!hoveredFeature) {
                return
              }
              const glyph = self.getGlyph(hoveredFeature.feature)

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
