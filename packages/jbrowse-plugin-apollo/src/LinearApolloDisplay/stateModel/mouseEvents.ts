import { type AnnotationFeature } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import type PluginManager from '@jbrowse/core/PluginManager'
import { type AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { type MenuItem } from '@jbrowse/core/ui'
import { type Frame, getFrame } from '@jbrowse/core/util'
import { type Theme } from '@mui/material'
import { autorun } from 'mobx'
import { type Instance, addDisposer } from 'mobx-state-tree'
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

function getTranslationRow(frame: Frame, bpPerPx: number) {
  const offset = bpPerPx <= 1 ? 2 : 0
  switch (frame) {
    case 3: {
      return 0
    }
    case 2: {
      return 1
    }
    case 1: {
      return 2
    }
    case -1: {
      return 3 + offset
    }
    case -2: {
      return 4 + offset
    }
    case -3: {
      return 5 + offset
    }
  }
}

function getSeqRow(
  strand: 1 | -1 | undefined,
  bpPerPx: number,
): number | undefined {
  if (bpPerPx > 1 || strand === undefined) {
    return
  }
  return strand === 1 ? 3 : 4
}

function highlightSeq(
  seqTrackOverlayctx: CanvasRenderingContext2D,
  theme: Theme | undefined,
  startPx: number,
  sequenceRowHeight: number,
  row: number | undefined,
  widthPx: number,
) {
  if (row !== undefined) {
    seqTrackOverlayctx.fillStyle =
      theme?.palette.action.focus ?? 'rgba(0,0,0,0.04)'
    seqTrackOverlayctx.fillRect(
      startPx,
      sequenceRowHeight * row,
      widthPx,
      sequenceRowHeight,
    )
  }
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
          topLevelFeature,
          bp,
          featureRow,
          featureTypeOntology,
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

export function mouseEventsSeqHightlightModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LinearApolloDisplayRendering = mouseEventsModelIntermediateFactory(
    pluginManager,
    configSchema,
  )

  return LinearApolloDisplayRendering.actions((self) => ({
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
            const seqTrackOverlayctx =
              self.seqTrackOverlayCanvas?.getContext('2d')
            if (!seqTrackOverlayctx) {
              return
            }

            seqTrackOverlayctx.clearRect(
              0,
              0,
              self.lgv.dynamicBlocks.totalWidthPx,
              self.lgv.bpPerPx <= 1 ? 125 : 95,
            )

            const {
              hoveredFeature,
              lgv,
              regions,
              sequenceRowHeight,
              session,
              theme,
            } = self

            if (!hoveredFeature) {
              return
            }
            const { feature } = hoveredFeature

            const { featureTypeOntology } =
              session.apolloDataStore.ontologyManager
            if (!featureTypeOntology) {
              throw new Error('featureTypeOntology is undefined')
            }
            for (const [idx, region] of regions.entries()) {
              if (featureTypeOntology.isTypeOf(feature.type, 'CDS')) {
                const parentFeature = feature.parent
                if (!parentFeature) {
                  continue
                }
                const cdsLocs = parentFeature.cdsLocations.find(
                  (loc) =>
                    feature.min === loc.at(0)?.min &&
                    feature.max === loc.at(-1)?.max,
                )
                if (!cdsLocs) {
                  continue
                }
                for (const dl of cdsLocs) {
                  const frame = getFrame(
                    dl.min,
                    dl.max,
                    feature.strand ?? 1,
                    dl.phase,
                  )
                  const row = getTranslationRow(frame, lgv.bpPerPx)
                  const offset =
                    (lgv.bpToPx({
                      refName: region.refName,
                      coord: dl.min,
                      regionNumber: idx,
                    })?.offsetPx ?? 0) - lgv.offsetPx
                  const widthPx = (dl.max - dl.min) / lgv.bpPerPx
                  const startPx = lgv.displayedRegions[idx].reversed
                    ? offset - widthPx
                    : offset

                  highlightSeq(
                    seqTrackOverlayctx,
                    theme,
                    startPx,
                    sequenceRowHeight,
                    row,
                    widthPx,
                  )
                }
              } else {
                const row = getSeqRow(feature.strand, lgv.bpPerPx)
                const offset =
                  (lgv.bpToPx({
                    refName: region.refName,
                    coord: feature.min,
                    regionNumber: idx,
                  })?.offsetPx ?? 0) - lgv.offsetPx
                const widthPx = feature.length / lgv.bpPerPx
                const startPx = lgv.displayedRegions[idx].reversed
                  ? offset - widthPx
                  : offset

                highlightSeq(
                  seqTrackOverlayctx,
                  theme,
                  startPx,
                  sequenceRowHeight,
                  row,
                  widthPx,
                )
              }
            }
          },
          { name: 'LinearApolloDisplayRenderSeqHighlight' },
        ),
      )
    },
  }))
}

export function mouseEventsModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LinearApolloDisplayMouseEvents = mouseEventsSeqHightlightModelFactory(
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
