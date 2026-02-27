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
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import type { CSSProperties } from 'react'

import {
  type Edge,
  getContextMenuItemsForFeature,
  getPropagatedLocationChanges,
  isCDSFeature,
  isExonFeature,
  selectFeatureAndOpenWidget,
} from '../../util'
import { isMouseOnFeatureEdge } from '../glyphs/util'
import type { CanvasMouseEvent } from '../types'

import { renderingModelFactory } from './rendering'

export interface MousePosition {
  x: number
  y: number
  assemblyName: string
  refName: string
  bp: number
  regionNumber: number
}

export function getMousePosition(
  event: React.MouseEvent,
  lgv: LinearGenomeViewModel,
): MousePosition {
  const canvas = event.currentTarget
  const { clientX, clientY } = event
  const { left, top } = canvas.getBoundingClientRect()
  const x = clientX - left
  const y = clientY - top
  const {
    coord: bp,
    index: regionNumber,
    assemblyName,
    refName,
  } = lgv.pxToBp(x)
  return { x, y, assemblyName, refName, bp, regionNumber }
}

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
        return getMousePosition(event, self.lgv)
      },
      getFeaturesAtMousePosition(mousePosition: MousePosition) {
        const { bp, assemblyName, refName, y } = mousePosition
        const row = Math.floor(y / self.apolloRowHeight)
        const featureLayout = self.layouts.get(assemblyName)?.get(refName)
        if (!featureLayout) {
          return []
        }
        return self.getFeaturesAtPosition(assemblyName, refName, row, bp)
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
      const mousePosition = self.getMousePosition(event)
      const features = self.getFeaturesAtMousePosition(mousePosition)
      if (features.length === 1) {
        return getContextMenuItemsForFeature(self, features[0])
      }
      const menuItems: MenuItem[] = []
      for (const feature of features) {
        const glyph = self.getGlyph(feature)
        menuItems.push({
          label: feature.type,
          subMenu: [
            ...getContextMenuItemsForFeature(self, feature),
            // @ts-expect-error ts doesn't understand mst extension
            ...glyph.getContextMenuItems(self, feature),
          ],
        })
      }
      return menuItems
    },
  }))
    .actions((self) => {
      function cancelDragListener(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          self.setDragging()
        }
      }
      return {
        // explicitly pass in a feature in case it's not the same as the one in
        // mousePosition (e.g. if features are drawn overlapping).
        startDrag(
          mousePosition: MousePosition,
          feature: AnnotationFeature,
          edge: Edge,
          shrinkParent = false,
        ) {
          globalThis.addEventListener('keydown', cancelDragListener, true)
          self.apolloDragging = {
            start: mousePosition,
            current: mousePosition,
            feature,
            edge,
            shrinkParent,
          }
        },
        endDrag() {
          globalThis.removeEventListener('keydown', cancelDragListener, true)
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
      }
    })
    .actions((self) => ({
      onMouseDown(event: CanvasMouseEvent) {
        const mousePosition = self.getMousePosition(event)
        const features = self.getFeaturesAtMousePosition(mousePosition)
        for (const feature of features.toReversed()) {
          const glyph = self.getGlyph(feature)
          if (glyph.isDraggable) {
            // @ts-expect-error ts doesn't understand mst extension
            const edge = isMouseOnFeatureEdge(mousePosition, feature, self)
            if (edge) {
              event.stopPropagation()
              self.startDrag(mousePosition, feature, edge, true)
              return
            }
          }
        }
      },
      onMouseMove(event: CanvasMouseEvent) {
        const mousePosition = self.getMousePosition(event)
        if (self.apolloDragging) {
          self.setCursor('col-resize')
          self.continueDrag(mousePosition, event)
          return
        }
        const features = self.getFeaturesAtMousePosition(mousePosition)
        let topFeature = features.at(-1)
        // TODO: can we get this special case for CDS to fit nicely in the glyph?
        if (topFeature && isCDSFeature(topFeature, self.session)) {
          const nextFeature = features.at(-2)
          if (nextFeature && !isExonFeature(nextFeature, self.session)) {
            topFeature = nextFeature
          }
        }
        if (topFeature) {
          self.setHoveredFeature({ feature: topFeature, bp: mousePosition.bp })
        } else {
          self.setHoveredFeature()
        }
        for (const feature of features.toReversed()) {
          const glyph = self.getGlyph(feature)
          if (
            glyph.isDraggable &&
            // @ts-expect-error ts doesn't understand mst extension
            isMouseOnFeatureEdge(mousePosition, feature, self)
          ) {
            self.setCursor('col-resize')
            return
          }
        }
        self.setCursor()
      },
      onMouseLeave() {
        self.setDragging()
        self.setHoveredFeature()
      },
      onMouseUp(event: CanvasMouseEvent) {
        if (self.apolloDragging) {
          self.endDrag()
          return
        }
        const mousePosition = self.getMousePosition(event)
        const features = self.getFeaturesAtMousePosition(mousePosition)
        let topFeature = features.at(-1)
        // TODO: can we get this special case for CDS to fit nicely in the glyph?
        if (topFeature && isCDSFeature(topFeature, self.session)) {
          const nextFeature = features.at(-2)
          if (nextFeature && !isExonFeature(nextFeature, self.session)) {
            topFeature = nextFeature
          }
        }
        if (topFeature) {
          selectFeatureAndOpenWidget(self, topFeature)
          self.setSelectedFeature(topFeature)
        } else {
          self.setSelectedFeature()
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
              const row = self.getRowForFeature(feature)
              if (row === undefined) {
                return
              }

              for (const block of dynamicBlocks.contentBlocks) {
                const blockLeftPx = block.offsetPx - offsetPx
                ctx.save()
                ctx.beginPath()
                ctx.rect(blockLeftPx, 0, block.widthPx, overlayCanvas.height)
                ctx.clip()
                if (
                  block.assemblyName === feature.assemblyId &&
                  doesIntersect2(
                    block.start,
                    block.end,
                    feature.min,
                    feature.max,
                  )
                ) {
                  // draw mouseover hovers
                  glyph.drawHover(
                    // @ts-expect-error ts doesn't understand mst extension
                    self,
                    ctx,
                    feature,
                    row,
                    block,
                  )
                }
                if (apolloDragging) {
                  const {
                    current,
                    start,
                    feature: dragFeature,
                  } = apolloDragging
                  const dragMin = Math.min(current.bp, start.bp)
                  const dragMax = Math.max(current.bp, start.bp)
                  if (
                    doesIntersect2(block.start, block.end, dragMin, dragMax)
                  ) {
                    const dragGlyph = self.getGlyph(dragFeature)
                    const row = self.getRowForFeature(dragFeature)

                    if (row !== undefined) {
                      // draw dragging previews
                      dragGlyph.drawDragPreview(
                        // @ts-expect-error ts doesn't understand mst extension
                        self,
                        ctx,
                        dragFeature,
                        row,
                        block,
                      )
                    }
                  }
                }

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
