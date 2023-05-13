import { getContainingView } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Change } from 'apollo-common'
import { AnnotationFeatureI } from 'apollo-mst'
import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'

import { Glyph } from '../glyphs/Glyph'
import { CanvasMouseEvent } from '../types'

/**
 * @deprecated
 * temporary interface showing what's in the rest of the state model.
 * delete this when the state model is fully refactored to split into multiple files.
 *
 * If this doesn't match the full state model, this is probably the one that
 * needs to change.
 */
export interface RestOfLinearApolloDisplayStateModelTemporaryDeleteMeAsap {
  overlayCanvas: HTMLCanvasElement | null
  apolloRowHeight: number
  featureLayouts: Map<number, [number, AnnotationFeatureI][]>[]
  getGlyph(f: AnnotationFeatureI, bpPerPx: number): Glyph
  setSelectedFeature(f: AnnotationFeatureI): void
  getAssemblyId(assemblyName: string): string
  changeManager?: { submit(change: Change): void }
  featuresHeight: number
  regionCannotBeRendered(): string | undefined
}

function getMousePosition(event: CanvasMouseEvent, lgv: LinearGenomeViewModel) {
  const canvas = event.currentTarget
  const { clientX, clientY } = event
  const { left, top } = canvas.getBoundingClientRect() || {
    left: 0,
    top: 0,
  }
  const x = clientX - left
  const y = clientY - top
  const { refName, coord: bp, index: regionNumber } = lgv.pxToBp(x)
  return { x, y, refName, bp, regionNumber }
}
/** extended information about the position of the mouse on the canvas, including the refName, bp, and displayedRegion number */
export type MousePosition = ReturnType<typeof getMousePosition>

export default types
  .model('LinearApolloDisplayMouseSupport', {})
  .volatile((self) => ({
    lgv: getContainingView(self) as unknown as LinearGenomeViewModel,
    apolloDragging: null as {
      start: {
        glyph?: Glyph
        feature?: AnnotationFeatureI
        topLevelFeature?: AnnotationFeatureI
        mousePosition: MousePosition
      }
      current: {
        glyph?: Glyph
        feature?: AnnotationFeatureI
        topLevelFeature?: AnnotationFeatureI
        mousePosition: MousePosition
      }
    } | null,
  }))
  .views((s) => {
    const self = s as typeof s &
      RestOfLinearApolloDisplayStateModelTemporaryDeleteMeAsap

    return {
      get displayedRegions() {
        return self.lgv.displayedRegions
      },
      getMousePosition(event: CanvasMouseEvent) {
        return getMousePosition(event, self.lgv)
      },
      getFeatureAndGlyphUnderMouse(event: CanvasMouseEvent) {
        const mousePosition = this.getMousePosition(event)
        const { y, bp, regionNumber } = mousePosition
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
        const glyph = self.getGlyph(topLevelFeature, self.lgv.bpPerPx)
        const topRow = row - featureRow
        const feature = glyph.getFeatureFromLayout(topLevelFeature, bp, topRow)
        return { feature, topLevelFeature, glyph, mousePosition }
      },
    }
  })
  .volatile((self) => ({
    apolloHover: null as ReturnType<
      typeof self['getFeatureAndGlyphUnderMouse']
    > | null,
    apolloContextMenuFeature: undefined as AnnotationFeatureI | undefined,
  }))
  .actions((s) => {
    const self = s as typeof s &
      RestOfLinearApolloDisplayStateModelTemporaryDeleteMeAsap

    return {
      setApolloHover(n: typeof self['apolloHover']) {
        self.apolloHover = n
      },
      setDragging(dragInfo?: typeof self.apolloDragging) {
        self.apolloDragging = dragInfo || null
      },
      onMouseDown(event: CanvasMouseEvent) {
        const { glyph, feature, topLevelFeature } =
          self.getFeatureAndGlyphUnderMouse(event)
        if (glyph && feature && topLevelFeature) {
          glyph.onMouseDown(
            // @ts-expect-error we do not currently have a good type for the full state model available in this file
            self,
            event,
          )
        }
      },
      startDrag(event: CanvasMouseEvent) {
        const { feature, topLevelFeature, glyph, mousePosition } =
          self.getFeatureAndGlyphUnderMouse(event)
        if (feature && topLevelFeature && glyph) {
          self.apolloDragging = {
            start: { glyph, feature, topLevelFeature, mousePosition },
            current: { glyph, feature, topLevelFeature, mousePosition },
          }
          if (
            !glyph.startDrag(
              // @ts-expect-error we do not currently have a good type for the full state model available in this file
              self,
              event,
            )
          ) {
            self.apolloDragging = null
          }
        }
      },
      continueDrag(event: CanvasMouseEvent) {
        if (!self.apolloDragging) {
          throw new Error(
            'continueDrag() called with no current drag in progress',
          )
        }
        event.stopPropagation()
        const { feature, topLevelFeature, glyph, mousePosition } =
          self.getFeatureAndGlyphUnderMouse(event)
        self.apolloDragging = {
          ...self.apolloDragging,
          current: {
            feature,
            topLevelFeature,
            glyph,
            mousePosition,
          },
        }
      },
      endDrag(event: CanvasMouseEvent) {
        this.continueDrag(event)
        // @ts-expect-error we do not currently have a good type for the full state model available in this file
        self.apolloDragging?.start.glyph?.executeDrag(self, event)
        this.setDragging(undefined)
      },
      onMouseMove(event: CanvasMouseEvent) {
        const { buttons } = event
        const hover = self.getFeatureAndGlyphUnderMouse(event)
        const { glyph } = hover
        if (glyph) {
          glyph.onMouseMove(
            // @ts-expect-error we do not currently have a good type for the full state model available in this file
            self,
            event,
          )
        }

        if (buttons) {
          // if button 1 is being held down while moving, we must be dragging
          if (buttons === 1) {
            if (!self.apolloDragging) {
              // start drag if not already dragging
              this.startDrag(event)
            } else {
              // otherwise update the drag state
              this.continueDrag(event)
            }
          }
        } else {
          // if no buttons, update mouseover hover
          const { feature, topLevelFeature } = hover
          if (feature && glyph && topLevelFeature) {
            this.setApolloHover(hover)
          } else {
            this.setApolloHover(null)
          }
        }
      },
      onMouseLeave(event: CanvasMouseEvent) {
        this.setDragging(undefined)

        const { glyph } = self.getFeatureAndGlyphUnderMouse(event)
        if (glyph) {
          glyph.onMouseLeave(
            // @ts-expect-error we do not currently have a good type for the full state model available in this file
            self,
            event,
          )
        }
      },
      onMouseUp(event: CanvasMouseEvent) {
        const { glyph } = self.getFeatureAndGlyphUnderMouse(event)
        if (glyph) {
          glyph.onMouseUp(
            // @ts-expect-error we do not currently have a good type for the full state model available in this file
            self,
            event,
          )
        }

        if (self.apolloDragging) {
          this.endDrag(event)
        }
      },
      onClick(event: CanvasMouseEvent) {
        // TODO: set the selected feature
      },
      setApolloContextMenuFeature(feature?: AnnotationFeatureI) {
        self.apolloContextMenuFeature = feature
      },
      onContextMenu(event: CanvasMouseEvent) {
        event.preventDefault()
        const { feature } = self.getFeatureAndGlyphUnderMouse(event)
        if (feature) {
          this.setApolloContextMenuFeature(feature)
        }
      },
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

              // draw mouseover hovers
              self.apolloHover?.glyph?.drawHover(
                // @ts-expect-error we do not currently have a good type for the full state model available in this file
                self,
                ctx,
              )

              // dragging previews
              if (self.apolloDragging) {
                // NOTE: the glyph where the drag started is responsible for drawing the preview.
                // it can call methods in other glyphs to help with this though.

                self.apolloDragging.start.glyph?.drawDragPreview(
                  // @ts-expect-error we do not currently have a good type for the full state model available in this file
                  self,
                  ctx,
                )
              }
            },
            { name: 'LinearApolloDisplayRenderMouseoverAndDrag' },
          ),
        )
      },
    }
  })
