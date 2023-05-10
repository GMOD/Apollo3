import { getContainingView } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Change } from 'apollo-common'
import { AnnotationFeatureI } from 'apollo-mst'
import { LocationEndChange, LocationStartChange } from 'apollo-shared'
import { types } from 'mobx-state-tree'

import { Glyph } from '../glyphs/Glyph'

/**
 * @deprecated
 * temporary interface showing what's in the rest of the state model.
 * delete this when the state model is fully refactored to split into multiple files
 */
interface RestOfLinearApolloDisplayStateModelTemporaryDeleteMeAsap {
  overlayCanvas: HTMLCanvasElement | null
  apolloRowHeight: number
  featureLayouts: Map<number, [number, AnnotationFeatureI][]>[]
  getGlyph(f: AnnotationFeatureI): Glyph
  setSelectedFeature(f: AnnotationFeatureI): void
  getAssemblyId(assemblyName: string): string
  changeManager?: { submit(change: Change): void }
}

export default types
  .model('LinearApolloDisplayMouseSupport', {})
  .volatile((self) => ({
    apolloFeatureUnderMouse: undefined as AnnotationFeatureI | undefined,
    movedDuringLastMouseDown: false,
    overEdge: null as 'start' | 'end' | null,
    lgv: getContainingView(self) as unknown as LinearGenomeViewModel,
    dragging: null as {
      edge: 'start' | 'end'
      feature: AnnotationFeatureI
      x: number
      y: number
      regionIndex: number
    } | null,
    apolloContextMenuFeature: undefined as AnnotationFeatureI | undefined,
  }))
  .views((self) => ({
    get displayedRegions() {
      return self.lgv.displayedRegions
    },
  }))
  .actions((s) => {
    const self = s as typeof s &
      RestOfLinearApolloDisplayStateModelTemporaryDeleteMeAsap

    return {
      setMovedDuringLastMouseDown(moved: boolean) {
        self.movedDuringLastMouseDown = moved
      },
      setApolloFeatureUnderMouse(feature?: AnnotationFeatureI) {
        self.apolloFeatureUnderMouse = feature
      },
      setOverEdge(edge?: 'start' | 'end') {
        self.overEdge = edge || null
      },
      setDragging(dragInfo?: {
        edge: 'start' | 'end'
        feature: AnnotationFeatureI
        x: number
        y: number
        regionIndex: number
      }) {
        self.dragging = dragInfo || null
      },
      onMouseMove(event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
        if (!self.overlayCanvas) {
          return
        }
        const { clientX, clientY, buttons } = event
        if (!self.movedDuringLastMouseDown && buttons === 1) {
          this.setMovedDuringLastMouseDown(true)
        }
        const { left, top } = self.overlayCanvas.getBoundingClientRect() || {
          left: 0,
          top: 0,
        }
        const x = clientX - left
        const bpInfo = self.lgv.pxToBp(x)
        const { refName, coord, index: regionNumber } = bpInfo

        const y = clientY - top

        if (self.dragging) {
          const { edge, feature } = self.dragging
          this.setDragging({
            edge,
            feature,
            x,
            y: self.dragging.y,
            regionIndex: regionNumber,
          })
          return
        }

        const row = Math.floor(y / self.apolloRowHeight)
        if (row === undefined) {
          this.setApolloFeatureUnderMouse(undefined)
          return
        }
        const featureLayout = self.featureLayouts[bpInfo.index]
        const layoutRow = featureLayout.get(row)
        if (!layoutRow) {
          this.setApolloFeatureUnderMouse(undefined)
          return
        }
        const [featureRow, feat] =
          layoutRow.find((f) => coord >= f[1].min && coord <= f[1].max) || []
        let feature: AnnotationFeatureI | undefined = feat
        if (feature && featureRow) {
          const topRow = row - featureRow
          feature = self
            .getGlyph(feature)
            .getFeatureFromLayout(feature, coord, topRow)
        }

        if (feature) {
          // TODO: check reversed
          // TODO: ensure feature is in interbase
          const startPxInfo = self.lgv.bpToPx({
            refName,
            coord: feature.start,
            regionNumber,
          })
          const endPxInfo = self.lgv.bpToPx({
            refName,
            coord: feature.end,
            regionNumber,
          })
          if (startPxInfo !== undefined && endPxInfo !== undefined) {
            const startPx = startPxInfo.offsetPx - self.lgv.offsetPx
            const endPx = endPxInfo.offsetPx - self.lgv.offsetPx
            if (endPx - startPx < 8) {
              this.setOverEdge(undefined)
            } else if (Math.abs(startPx - x) < 4) {
              this.setOverEdge('start')
            } else if (Math.abs(endPx - x) < 4) {
              this.setOverEdge('end')
            } else {
              this.setOverEdge(undefined)
            }
          } else {
            this.setOverEdge(undefined)
          }
        }
        this.setApolloFeatureUnderMouse(feature)
      },
      onMouseLeave() {
        this.setApolloFeatureUnderMouse(undefined)
      },
      onMouseDown(event: React.MouseEvent) {
        if (!self.overlayCanvas) {
          return
        }
        if (!(self.apolloFeatureUnderMouse && self.overEdge)) {
          return
        }
        event.stopPropagation()
        const { left, top } = self.overlayCanvas.getBoundingClientRect() || {
          left: 0,
          top: 0,
        }
        const { clientX, clientY } = event

        const x = clientX - left
        const y = clientY - top
        const bpInfo = self.lgv.pxToBp(x)
        const { index } = bpInfo

        this.setDragging({
          edge: self.overEdge,
          feature: self.apolloFeatureUnderMouse,
          x,
          y,
          regionIndex: index,
        })
      },
      onMouseUp() {
        if (!self.movedDuringLastMouseDown) {
          if (self.apolloFeatureUnderMouse) {
            self.setSelectedFeature(self.apolloFeatureUnderMouse)
          }
        } else if (self.dragging) {
          const { feature, edge, regionIndex } = self.dragging
          const bp = feature[edge]
          const region = self.displayedRegions[regionIndex]

          const assembly = self.getAssemblyId(region.assemblyName)
          let change: LocationEndChange | LocationStartChange
          if (edge === 'end') {
            const featureId = feature._id
            const oldEnd = feature.end
            const newEnd = Math.round(bp)
            change = new LocationEndChange({
              typeName: 'LocationEndChange',
              changedIds: [featureId],
              featureId,
              oldEnd,
              newEnd,
              assembly,
            })
          } else {
            const featureId = feature._id
            const oldStart = feature.start
            const newStart = Math.round(bp)
            change = new LocationStartChange({
              typeName: 'LocationStartChange',
              changedIds: [featureId],
              featureId,
              oldStart,
              newStart,
              assembly,
            })
          }
          self.changeManager?.submit(change)
        }
        this.setDragging(undefined)
        this.setMovedDuringLastMouseDown(false)
      },
      setApolloContextMenuFeature(feature?: AnnotationFeatureI) {
        self.apolloContextMenuFeature = feature
      },
      onContextMenu(event: React.MouseEvent) {
        event.preventDefault()
        this.setApolloContextMenuFeature(self.apolloFeatureUnderMouse)
      },
    }
  })
