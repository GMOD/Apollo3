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
    apolloFeatureUnderMouse: undefined as AnnotationFeatureI | undefined,
    apolloContextMenuFeature: undefined as AnnotationFeatureI | undefined,
    movedDuringLastMouseDown: false,
    overEdge: null as 'start' | 'end' | null,
    lgv: getContainingView(self) as unknown as LinearGenomeViewModel,
    dragging: null as {
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
        if (row === undefined) {
          return { mousePosition }
        }
        const featureLayout = self.featureLayouts[regionNumber]
        const layoutRow = featureLayout.get(row)
        if (!layoutRow) {
          return { mousePosition }
        }
        const [featureRow, topLevelFeature] =
          layoutRow.find((f) => bp >= f[1].min && bp <= f[1].max) || []
        let feature: AnnotationFeatureI | undefined = topLevelFeature
        let glyph: Glyph | undefined
        if (feature && featureRow) {
          glyph = self.getGlyph(feature, self.lgv.bpPerPx)
          const topRow = row - featureRow
          feature = glyph.getFeatureFromLayout(feature, bp, topRow)
        }
        return { feature, topLevelFeature, glyph, mousePosition }
      },
    }
  })
  .actions((s) => {
    const self = s as typeof s &
      RestOfLinearApolloDisplayStateModelTemporaryDeleteMeAsap

    return {
      setDragging(dragInfo?: typeof self.dragging) {
        self.dragging = dragInfo || null
      },
      onMouseDown(event: CanvasMouseEvent) {
        return
      },
      startDrag(event: CanvasMouseEvent) {
        const { feature, topLevelFeature, glyph, mousePosition } =
          self.getFeatureAndGlyphUnderMouse(event)
        if (feature && topLevelFeature && glyph) {
          self.dragging = {
            start: { glyph, feature, topLevelFeature, mousePosition },
            current: { glyph, feature, topLevelFeature, mousePosition },
          }
        }
      },
      continueDrag(event: CanvasMouseEvent) {
        if (!self.dragging) {
          throw new Error(
            'continueDrag() called with no current drag in progress',
          )
        }
        const { feature, topLevelFeature, glyph, mousePosition } =
          self.getFeatureAndGlyphUnderMouse(event)
        self.dragging.current = {
          feature,
          topLevelFeature,
          glyph,
          mousePosition,
        }
      },
      endDrag(event: CanvasMouseEvent) {
        this.continueDrag(event)
        // @ts-expect-error we do not currently have a good type for the full state model available in this file
        self.dragging?.start.glyph?.executeDrag(self, event)
        this.setDragging(undefined)
      },
      onMouseMove(event: CanvasMouseEvent) {
        if (!self.overlayCanvas) {
          return
        }
        const { buttons } = event

        // if button is being held down while moving, we must be dragging
        if (buttons === 1) {
          if (!self.dragging) {
            // start drag if not already dragging
            this.startDrag(event)
          } else {
            // otherwise update the drag state
            this.continueDrag(event)
          }
        }
      },
      onMouseLeave(event: CanvasMouseEvent) {
        this.setDragging(undefined)
      },
      onMouseUp(event: CanvasMouseEvent) {
        if (self.dragging) {
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
          this.setApolloContextMenuFeature(self.apolloFeatureUnderMouse)
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

              // dragging previews
              if (self.dragging) {
                // @ts-expect-error we do not currently have a good type for the full state model available in this file
                self.dragging.start.glyph?.drawDragPreview(self, ctx)
              }

              // // mouseover highlights
              // const { apolloFeatureUnderMouse } = self
              // if (!apolloFeatureUnderMouse) {
              //   return
              // }
              // self.featureLayouts.forEach((featureLayout, idx) => {
              //   const displayedRegion = self.displayedRegions[idx]
              //   featureLayout.forEach((featureLayoutRow, row) => {
              //     featureLayoutRow.forEach(([featureRow, feature]) => {
              //       if (featureRow > 0) {
              //         return
              //       }
              //       if (feature._id !== apolloFeatureUnderMouse._id) {
              //         return
              //       }
              //       const x =
              //         (self.lgv.bpToPx({
              //           refName: displayedRegion.refName,
              //           coord: feature.min,
              //           regionNumber: idx,
              //         })?.offsetPx || 0) - self.lgv.offsetPx
              //       new BoxGlyph().draw(
              //         feature,
              //         ctx,
              //         x,
              //         row * self.apolloRowHeight,
              //         self.lgv.bpPerPx,
              //         self.apolloRowHeight,
              //         displayedRegion.reversed,
              //       )
              //     })
              //   })
              // })
            },
            { name: 'LinearApolloDisplayRenderMouseoverAndDrag' },
          ),
        )
      },
    }
  })
