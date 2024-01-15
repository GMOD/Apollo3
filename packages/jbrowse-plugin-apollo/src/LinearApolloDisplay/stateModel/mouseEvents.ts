import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnnotationFeatureI } from 'apollo-mst'
import { autorun } from 'mobx'
import { Instance, addDisposer } from 'mobx-state-tree'
import type { CSSProperties } from 'react'

import { Coord } from '../components'
import { Glyph } from '../glyphs/Glyph'
import { CanvasMouseEvent } from '../types'
import { getGlyph } from './getGlyph'
import { renderingModelFactory } from './rendering'

/** extended information about the position of the mouse on the canvas, including the refName, bp, and displayedRegion number */
export interface MousePosition {
  x: number
  y: number
  refName: string
  bp: number
  regionNumber: number
}

export interface FeatureAndGlyphInfo {
  feature?: AnnotationFeatureI
  topLevelFeature?: AnnotationFeatureI
  glyph?: Glyph
  mousePosition?: MousePosition
}

export interface CDSDiscontinuousLocation {
  start: number
  end: number
  phase: 0 | 1 | 2 | undefined
  idx?: number
}

function getMousePosition(
  event: CanvasMouseEvent,
  lgv: LinearGenomeViewModel,
): MousePosition {
  const canvas = event.currentTarget
  const { clientX, clientY } = event
  const { left, top } = canvas.getBoundingClientRect() || { left: 0, top: 0 }
  const x = clientX - left
  const y = clientY - top
  const { coord: bp, index: regionNumber, refName } = lgv.pxToBp(x)
  return { x, y, refName, bp, regionNumber }
}

function getSeqRow(feature: AnnotationFeatureI, bpPerPx: number) {
  if (feature.type === 'CDS' && feature.phase) {
    return feature.strand === -1
      ? (feature.end - feature.phase) % 3
      : (feature.start - feature.phase) % 3
  }

  if (bpPerPx <= 1) {
    return feature.strand === -1 ? 4 : 3
  }

  return
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
          feature?: AnnotationFeatureI
          topLevelFeature?: AnnotationFeatureI
          discontinuousLocation?: CDSDiscontinuousLocation
          mousePosition: MousePosition
        }
        current: {
          glyph?: Glyph
          feature?: AnnotationFeatureI
          topLevelFeature?: AnnotationFeatureI
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
          async () => {
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
            const { feature, mousePosition } = apolloHover
            if (!feature || !mousePosition) {
              return
            }

            for (const [idx, region] of regions.entries()) {
              const trnslXOffset =
                (lgv.bpToPx({
                  refName: region.refName,
                  coord: feature.start,
                  regionNumber: idx,
                })?.offsetPx ?? 0) - lgv.offsetPx
              const trnslWidthPx = feature.length / lgv.bpPerPx
              const trnslStartPx = displayedRegions[idx].reversed
                ? trnslXOffset - trnslWidthPx
                : trnslXOffset

              const row = getSeqRow(feature, lgv.bpPerPx)
              if (row) {
                seqTrackOverlayctx.fillStyle =
                  theme?.palette.action.focus ?? 'rgba(0,0,0,0.04)'
                seqTrackOverlayctx.fillRect(
                  trnslStartPx,
                  sequenceRowHeight * row,
                  trnslWidthPx,
                  sequenceRowHeight,
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
        if (feature && topLevelFeature && glyph && mousePosition) {
          let dl, idx
          if (
            feature.discontinuousLocations &&
            feature.discontinuousLocations.length > 0
          ) {
            for (let i = 0; i < feature.discontinuousLocations.length; i++) {
              if (
                mousePosition.bp >= feature.discontinuousLocations[i].start &&
                mousePosition.bp <= feature.discontinuousLocations[i].end
              ) {
                idx = i
                dl = feature.discontinuousLocations[idx]
                break
              }
            }
          }
          self.apolloDragging = {
            start: {
              glyph,
              feature,
              topLevelFeature,
              discontinuousLocation: dl
                ? {
                    start: dl.start,
                    end: dl.end,
                    phase: dl.phase,
                    idx,
                  }
                : undefined,
              mousePosition,
            },
            current: { glyph, feature, topLevelFeature, mousePosition },
          }
          if (!glyph.startDrag(self, event)) {
            self.apolloDragging = null
          }
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

              const {
                apolloDragging,
                apolloHover,
                displayedRegions,
                featureLayouts,
                lgv,
              } = self
              if (!apolloHover) {
                return
              }
              const { feature, glyph } = apolloHover
              if (!feature) {
                return
              }
              let rowNum = 0
              let xOffset = 0
              let reversed = false
              for (const [idx, featureLayout] of featureLayouts.entries()) {
                const displayedRegion = displayedRegions[idx]
                for (const [row, featureLayoutRow] of featureLayout.entries()) {
                  if (rowNum !== 0) {
                    continue
                  }
                  for (const [, f] of featureLayoutRow) {
                    for (const [, cf] of f.children ?? new Map()) {
                      if (rowNum !== 0) {
                        continue
                      }
                      xOffset =
                        (lgv.bpToPx({
                          refName: displayedRegion.refName,
                          coord: feature.min,
                          regionNumber: idx,
                        })?.offsetPx ?? 0) - lgv.offsetPx
                      ;({ reversed } = displayedRegion)

                      if (cf._id === feature._id) {
                        rowNum = row
                        continue
                      }
                      for (const [, annotationFeature] of cf.children ??
                        new Map()) {
                        if (rowNum !== 0) {
                          continue
                        }
                        if (annotationFeature._id === feature._id) {
                          rowNum = row
                          continue
                        }
                      }
                    }
                  }
                }
              }

              // draw mouseover hovers
              glyph?.drawHover(self, ctx, rowNum, xOffset, reversed)

              // draw tooltip on hover
              glyph?.drawTooltip(self, ctx)

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
export type LinearApolloDisplayMouseEvents =
  Instance<LinearApolloDisplayMouseEventsModel>
