/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import { doesIntersect2 } from '@jbrowse/core/util'
import { type Instance, addDisposer, types } from '@jbrowse/mobx-state-tree'
import { type Theme, createTheme } from '@mui/material'
import { autorun } from 'mobx'

import type { ApolloSessionModel } from '../../session'

import { layoutsModelFactory } from './layouts'

export function renderingModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LinearApolloDisplayLayouts = layoutsModelFactory(
    pluginManager,
    configSchema,
  )

  return LinearApolloDisplayLayouts.named('LinearApolloDisplayRendering')
    .props({
      apolloRowHeight: 20,
      detailsMinHeight: 200,
      detailsHeight: 200,
      isShown: true,
      filteredTranscripts: types.array(types.string),
    })
    .volatile(() => ({
      canvas: null as HTMLCanvasElement | null,
      overlayCanvas: null as HTMLCanvasElement | null,
      collaboratorCanvas: null as HTMLCanvasElement | null,
      theme: createTheme(),
    }))
    .views((self) => ({
      get featuresHeight() {
        return (self.highestRow + 1) * self.apolloRowHeight
      },
      get canvasPatterns(): Record<
        'forward' | 'backward',
        CanvasPattern | null
      > {
        const patterns: Record<'forward' | 'backward', CanvasPattern | null> = {
          forward: null,
          backward: null,
        }
        const canvas = document.createElement('canvas')
        const ctx = canvas?.getContext('2d')
        if (!ctx) {
          return patterns
        }
        const canvasSize = 10
        canvas.width = canvas.height = canvasSize
        const { theme } = self
        const stripeColor1 =
          theme.palette.mode === 'light' ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.75)'
        const stripeColor2 =
          theme.palette.mode === 'light'
            ? 'rgba(255,255,255,0.25)'
            : 'rgba(0,0,0,0.50)'
        const directions = ['forward', 'backward'] as const
        for (const direction of directions) {
          const gradient =
            direction === 'forward'
              ? ctx.createLinearGradient(0, canvasSize, canvasSize, 0)
              : ctx.createLinearGradient(0, 0, canvasSize, canvasSize)
          gradient.addColorStop(0, stripeColor1)
          gradient.addColorStop(0.25, stripeColor1)
          gradient.addColorStop(0.25, stripeColor2)
          gradient.addColorStop(0.5, stripeColor2)
          gradient.addColorStop(0.5, stripeColor1)
          gradient.addColorStop(0.75, stripeColor1)
          gradient.addColorStop(0.75, stripeColor2)
          gradient.addColorStop(1, stripeColor2)
          ctx.fillStyle = gradient
          ctx.clearRect(0, 0, canvasSize, canvasSize)
          ctx.fillRect(0, 0, canvasSize, canvasSize)
          patterns[direction] = ctx.createPattern(canvas, 'repeat')
        }
        return patterns
      },
    }))
    .actions((self) => ({
      toggleShown() {
        self.isShown = !self.isShown
      },
      setDetailsHeight(newHeight: number) {
        self.detailsHeight = self.isShown
          ? Math.max(
              Math.min(newHeight, self.height - 100),
              Math.min(self.height, self.detailsMinHeight),
            )
          : newHeight
      },
      setCanvas(canvas: HTMLCanvasElement | null) {
        self.canvas = canvas
      },
      setOverlayCanvas(canvas: HTMLCanvasElement | null) {
        self.overlayCanvas = canvas
      },
      setCollaboratorCanvas(canvas: HTMLCanvasElement | null) {
        self.collaboratorCanvas = canvas
      },
      setTheme(theme: Theme) {
        self.theme = theme
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
              const ctx = self.collaboratorCanvas?.getContext('2d')
              if (!ctx) {
                return
              }
              ctx.clearRect(
                0,
                0,
                self.lgv.dynamicBlocks.totalWidthPx,
                self.featuresHeight,
              )
              for (const collaborator of (
                self.session as unknown as ApolloSessionModel
              ).collaborators) {
                const { locations } = collaborator
                if (locations.length === 0) {
                  continue
                }
                let idx = 0
                for (const displayedRegion of self.lgv.displayedRegions) {
                  for (const location of locations) {
                    if (location.refSeq !== displayedRegion.refName) {
                      continue
                    }
                    const { end, refSeq, start } = location
                    const locationStartPxInfo = self.lgv.bpToPx({
                      refName: refSeq,
                      coord: start,
                      regionNumber: idx,
                    })
                    if (!locationStartPxInfo) {
                      continue
                    }
                    const locationStartPx =
                      locationStartPxInfo.offsetPx - self.lgv.offsetPx
                    const locationWidthPx = (end - start) / self.lgv.bpPerPx
                    ctx.fillStyle = 'rgba(0,255,0,.2)'
                    ctx.fillRect(locationStartPx, 1, locationWidthPx, 100)
                    ctx.fillStyle = 'black'
                    ctx.fillText(
                      collaborator.name,
                      locationStartPx + 1,
                      11,
                      locationWidthPx - 2,
                    )
                  }
                  idx++
                }
              }
            },
            { name: 'LinearApolloDisplayRenderCollaborators' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const { canvas, featureLayouts, lgv } = self
              if (
                !lgv.initialized ||
                self.regionCannotBeRendered() ||
                !canvas
              ) {
                return
              }
              const { dynamicBlocks, offsetPx } = lgv

              const ctx = canvas.getContext('2d')
              if (!ctx) {
                return
              }
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              for (const [idx, featureLayout] of featureLayouts.entries()) {
                const block = dynamicBlocks.contentBlocks.at(idx)
                if (!block) {
                  continue
                }
                const blockLeftPx = block.offsetPx - offsetPx
                for (const [row, featureLayoutRow] of featureLayout.entries()) {
                  for (const [featureRow, featureId] of featureLayoutRow) {
                    const feature = self.getAnnotationFeatureById(featureId)
                    if (featureRow > 0 || !feature) {
                      continue
                    }
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
                    ctx.save()
                    ctx.beginPath()
                    ctx.rect(blockLeftPx, 0, block.widthPx, canvas.height)
                    ctx.clip()
                    // @ts-expect-error ts doesn't understand mst extension
                    self.getGlyph(feature).draw(self, ctx, feature, row, block)
                    ctx.restore()
                  }
                }
              }
            },
            { name: 'LinearApolloDisplayRenderFeatures' },
          ),
        )
      },
    }))
}

export type LinearApolloDisplayRenderingModel = ReturnType<
  typeof renderingModelFactory
>
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearApolloDisplayRendering
  extends Instance<LinearApolloDisplayRenderingModel> {}
