import { AnnotationFeature } from '@apollo-annotation/mst'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Theme } from '@mui/material'
import { autorun } from 'mobx'
import { Instance, addDisposer } from 'mobx-state-tree'
import type { CSSProperties } from 'react'

import { Coord } from '../components'
import { Glyph } from '../glyphs/Glyph'
import { CanvasMouseEvent } from '../types'
import { getGlyph } from './getGlyph'
import { renderingModelFactory } from './rendering'
import { Frame, getFrame } from '@jbrowse/core/util'

/** extended information about the position of the mouse on the canvas, including the refName, bp, and displayedRegion number */
export interface MousePosition {
  x: number
  y: number
  refName: string
  bp: number
  regionNumber: number
}

export interface FeatureAndGlyphInfo {
  feature?: AnnotationFeature
  topLevelFeature?: AnnotationFeature
  glyph?: Glyph
  mousePosition?: MousePosition
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
        start: {
          glyph?: Glyph
          feature?: AnnotationFeature
          topLevelFeature?: AnnotationFeature
          mousePosition: MousePosition
        }
        current: {
          glyph?: Glyph
          feature?: AnnotationFeature
          topLevelFeature?: AnnotationFeature
          mousePosition: MousePosition
        }
      } | null,
      cursor: undefined as CSSProperties['cursor'] | undefined,
      apolloHover: null as FeatureAndGlyphInfo | null,
    }))
    .views((self) => ({
      getFeatureAndGlyphUnderMouse(
        event: CanvasMouseEvent,
      ): FeatureAndGlyphInfo {
        const mousePosition = getMousePosition(event, self.lgv)
        const { bp, regionNumber, y } = mousePosition
        const row = Math.floor(y / self.apolloRowHeight)
        const featureLayout = self.featureLayouts[regionNumber]
        const layoutRow = featureLayout.get(row)
        if (!layoutRow) {
          return { mousePosition }
        }
        const foundFeature = layoutRow.find(
          (f) => bp >= f[1].min && bp <= f[1].max,
        )
        if (!foundFeature) {
          return { mousePosition }
        }
        const [featureRow, topLevelFeature] = foundFeature
        const glyph = getGlyph(topLevelFeature, self.lgv.bpPerPx)
        const feature = glyph.getFeatureFromLayout(
          topLevelFeature,
          bp,
          featureRow,
        )
        return { feature, topLevelFeature, glyph, mousePosition }
      },
    }))
    .actions((self) => ({
      continueDrag(event: CanvasMouseEvent) {
        if (!self.apolloDragging) {
          throw new Error(
            'continueDrag() called with no current drag in progress',
          )
        }
        event.stopPropagation()
        const { glyph } = self.apolloDragging.start
        const { mousePosition } = self.getFeatureAndGlyphUnderMouse(event)
        if (!(mousePosition && glyph)) {
          return
        }
        glyph.continueDrag(self, mousePosition)
      },
      setDragging(dragInfo?: typeof self.apolloDragging) {
        self.apolloDragging = dragInfo ?? null
      },
    }))
    .actions((self) => ({
      setApolloHover(n: (typeof self)['apolloHover']) {
        self.apolloHover = n
      },
      setCursor(cursor?: CSSProperties['cursor']) {
        if (self.cursor !== cursor) {
          self.cursor = cursor
        }
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
              apolloHover,
              displayedRegions,
              lgv,
              regions,
              sequenceRowHeight,
              theme,
            } = self

            if (!apolloHover) {
              return
            }
            const { feature, glyph, mousePosition, topLevelFeature } =
              apolloHover
            if (!feature || !mousePosition || !glyph) {
              return
            }

            for (const [idx, region] of regions.entries()) {
              if (feature.type === 'CDS') {
                const parentFeature = glyph.getParentFeature(
                  feature,
                  topLevelFeature,
                )
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
                  const startPx = displayedRegions[idx].reversed
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
                const startPx = displayedRegions[idx].reversed
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
    contextMenuItems(contextCoord?: Coord): MenuItem[] {
      const { apolloHover, lgv } = self
      const { topLevelFeature } = apolloHover ?? {}
      if (!(topLevelFeature && contextCoord)) {
        return []
      }
      const glyph = getGlyph(topLevelFeature, lgv.bpPerPx)
      return glyph.getContextMenuItems(self)
    },
  }))
    .actions((self) => ({
      startDrag(event: CanvasMouseEvent) {
        const { feature, glyph, mousePosition, topLevelFeature } =
          self.getFeatureAndGlyphUnderMouse(event)
        if (!(feature && topLevelFeature && glyph && mousePosition)) {
          return
        }
        self.apolloDragging = {
          start: {
            glyph,
            feature,
            topLevelFeature,
            mousePosition,
          },
          current: { glyph, feature, topLevelFeature, mousePosition },
        }
        if (!glyph.startDrag(self, event)) {
          self.apolloDragging = null
        }
      },
      endDrag(event: CanvasMouseEvent) {
        self.continueDrag(event)
        self.apolloDragging?.start.glyph?.executeDrag(self, event)
        self.setDragging()
      },
    }))
    .actions((self) => ({
      onMouseDown(event: CanvasMouseEvent) {
        const { feature, glyph, topLevelFeature } =
          self.getFeatureAndGlyphUnderMouse(event)
        if (glyph && feature && topLevelFeature) {
          glyph.onMouseDown(self, event)
        }
      },
      onMouseMove(event: CanvasMouseEvent) {
        const { buttons } = event
        const hover = self.getFeatureAndGlyphUnderMouse(event)
        const { glyph } = hover
        if (glyph) {
          glyph.onMouseMove(self, event)
        }

        if (buttons) {
          // if button 1 is being held down while moving, we must be dragging
          if (buttons === 1) {
            if (self.apolloDragging) {
              // otherwise update the drag state
              self.continueDrag(event)
            } else {
              // start drag if not already dragging
              self.startDrag(event)
            }
          }
        } else {
          // if no buttons, update mouseover hover
          const { feature, topLevelFeature } = hover
          if (feature && glyph && topLevelFeature) {
            self.setApolloHover(hover)
          } else {
            self.setApolloHover(null)
            self.setCursor()
          }
        }
      },
      onMouseLeave(event: CanvasMouseEvent) {
        self.setDragging()

        const { glyph } = self.getFeatureAndGlyphUnderMouse(event)
        if (glyph) {
          glyph.onMouseLeave(self, event)
        }
      },
      onMouseUp(event: CanvasMouseEvent) {
        const { glyph } = self.getFeatureAndGlyphUnderMouse(event)
        if (glyph) {
          glyph.onMouseUp(self, event)
        }

        if (self.apolloDragging) {
          self.endDrag(event)
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
              const { feature, glyph, mousePosition } = apolloHover
              if (!(feature && glyph && mousePosition)) {
                return
              }

              // draw mouseover hovers
              glyph.drawHover(self, ctx)

              // draw tooltip on hover
              glyph.drawTooltip(self, ctx)

              // dragging previews
              if (apolloDragging) {
                // NOTE: the glyph where the drag started is responsible for drawing the preview.
                // it can call methods in other glyphs to help with this though.
                apolloDragging.start.glyph?.drawDragPreview(self, ctx)
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
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LinearApolloDisplayMouseEvents
  extends Instance<LinearApolloDisplayMouseEventsModel> {}
