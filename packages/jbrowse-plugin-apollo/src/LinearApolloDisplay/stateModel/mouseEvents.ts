import type { AnnotationFeature } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import { doesIntersect2 } from '@jbrowse/core/util'
import { type Instance, addDisposer } from '@jbrowse/mobx-state-tree'
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
import type { CanvasMouseEvent } from '../types'

import { renderingModelFactory } from './rendering'

export function mouseEventsModelIntermediateFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LinearApolloDisplayRendering = renderingModelFactory(
    pluginManager,
    configSchema,
  )

  return LinearApolloDisplayRendering.named('LinearApolloDisplayMouseEvents')
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
        const featureLayout = self.featureLayouts[regionNumber]
        const layoutRow = featureLayout.get(row)
        if (!layoutRow) {
          return mousePosition
        }
        const foundFeature = layoutRow.find((f) => {
          const feature = self.getAnnotationFeatureById(f[1])
          return feature && bp >= feature.min && bp <= feature.max
        })
        if (!foundFeature) {
          return mousePosition
        }
        const [featureRow, topLevelFeatureId] = foundFeature
        const topLevelFeature = self.getAnnotationFeatureById(topLevelFeatureId)
        if (!topLevelFeature) {
          return mousePosition
        }
        const glyph = self.getGlyph(topLevelFeature)
        const { featureTypeOntology } =
          self.session.apolloDataStore.ontologyManager
        if (!featureTypeOntology) {
          throw new Error('featureTypeOntology is undefined')
        }
        const feature = glyph.getFeatureFromLayout(
          // @ts-expect-error ts doesn't understand mst extension
          self,
          topLevelFeature,
          bp,
          featureRow,
        )
        if (!feature) {
          return mousePosition
        }
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      updateFilteredTranscripts(forms: string[]) {
        return
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
  const LinearApolloDisplayMouseEvents = mouseEventsModelIntermediateFactory(
    pluginManager,
    configSchema,
  )

  return LinearApolloDisplayMouseEvents.views((self) => ({
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
              const { lgv, overlayCanvas } = self
              if (
                !lgv.initialized ||
                // This type is wrong in @jbrowse/core
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                self.regionCannotBeRendered() ||
                !overlayCanvas
              ) {
                return
              }
              const { dynamicBlocks, offsetPx } = lgv
              const ctx = overlayCanvas.getContext('2d')
              if (!ctx) {
                return
              }
              ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
              const { apolloDragging, hoveredFeature } = self
              if (!hoveredFeature) {
                return
              }
              const { feature } = hoveredFeature
              const glyph = self.getGlyph(feature)
              // draw tooltip on hover
              // @ts-expect-error ts doesn't understand mst extension
              glyph.drawTooltip(self, ctx)

              // dragging previews
              if (apolloDragging) {
                // NOTE: the glyph where the drag started is responsible for drawing the preview.
                // it can call methods in other glyphs to help with this though.
                const glyph = self.getGlyph(
                  apolloDragging.feature.topLevelFeature,
                )
                // @ts-expect-error ts doesn't understand mst extension
                glyph.drawDragPreview(self, ctx)
              }
              const position = self.getFeatureLayoutPosition(feature)
              if (!position) {
                return
              }
              const { featureRow, layoutRow } = position

              for (const block of dynamicBlocks.contentBlocks) {
                if (
                  !doesIntersect2(
                    block.start,
                    block.end,
                    feature.min,
                    feature.max,
                  )
                ) {
                  continue
                }
                const blockLeftPx = block.offsetPx - offsetPx
                ctx.save()
                ctx.beginPath()
                ctx.rect(blockLeftPx, 0, block.widthPx, overlayCanvas.height)
                ctx.clip()

                // draw mouseover hovers
                glyph.drawHover(
                  // @ts-expect-error ts doesn't understand mst extension
                  self,
                  ctx,
                  feature,
                  featureRow + layoutRow,
                  block,
                )

                ctx.restore()
              }
            },
            { name: 'LinearApolloDisplayRenderMouseoverAndDrag' },
          ),
        )
      },
    }))
}

export type LinearApolloDisplayMouseEventsModel = ReturnType<
  typeof mouseEventsModelIntermediateFactory
>
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearApolloDisplayMouseEvents
  extends Instance<LinearApolloDisplayMouseEventsModel> {}
