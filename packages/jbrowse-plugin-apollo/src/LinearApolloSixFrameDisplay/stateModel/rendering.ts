/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type PluginManager from '@jbrowse/core/PluginManager'
import { type AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { doesIntersect2 } from '@jbrowse/core/util'
import { type Theme } from '@mui/material'
import { autorun } from 'mobx'
import { type Instance, addDisposer, types } from 'mobx-state-tree'

import { type ApolloSessionModel } from '../../session'

import { layoutsModelFactory } from './layouts'

export function renderingModelIntermediateFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LinearApolloSixFrameDisplayLayouts = layoutsModelFactory(
    pluginManager,
    configSchema,
  )

  return LinearApolloSixFrameDisplayLayouts.named(
    'LinearApolloSixFrameDisplayRendering',
  )
    .props({
      sequenceRowHeight: 15,
      apolloRowHeight: 20,
      detailsMinHeight: 200,
      detailsHeight: 200,
      lastRowTooltipBufferHeight: 80,
      isShown: true,
      filteredTranscripts: types.array(types.string),
    })
    .volatile(() => ({
      canvas: null as HTMLCanvasElement | null,
      overlayCanvas: null as HTMLCanvasElement | null,
      collaboratorCanvas: null as HTMLCanvasElement | null,
      theme: undefined as Theme | undefined,
    }))
    .views((self) => ({
      get featuresHeight() {
        const featureLabelSpacer = self.showFeatureLabels ? 2 : 1
        return (
          featureLabelSpacer * ((self.highestRow + 1) * self.apolloRowHeight) +
          self.lastRowTooltipBufferHeight
        )
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
            { name: 'LinearApolloSixFrameDisplayRenderCollaborators' },
          ),
        )
      },
    }))
}

export function renderingModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LinearApolloSixFrameDisplayRendering =
    renderingModelIntermediateFactory(pluginManager, configSchema)

  return LinearApolloSixFrameDisplayRendering.actions((self) => ({
    afterAttach() {
      addDisposer(
        self,
        autorun(
          () => {
            const { canvas, featureLayouts, featuresHeight, lgv } = self
            if (!lgv.initialized || self.regionCannotBeRendered()) {
              return
            }
            const { displayedRegions, dynamicBlocks } = lgv

            const ctx = canvas?.getContext('2d')
            if (!ctx) {
              return
            }
            ctx.clearRect(0, 0, dynamicBlocks.totalWidthPx, featuresHeight)
            for (const [idx, featureLayout] of featureLayouts.entries()) {
              const displayedRegion = displayedRegions[idx]
              for (const [row, featureLayoutRow] of featureLayout.entries()) {
                for (const { feature } of featureLayoutRow) {
                  if (!feature.looksLikeGene) {
                    continue
                  }
                  if (
                    !doesIntersect2(
                      displayedRegion.start,
                      displayedRegion.end,
                      feature.min,
                      feature.max,
                    )
                  ) {
                    continue
                  }
                  const { topLevelFeature } = feature
                  const glyph = self.getGlyph(topLevelFeature)
                  if (glyph !== undefined) {
                    glyph.draw(ctx, topLevelFeature, row, self, idx)
                  }
                }
              }
            }
          },
          { name: 'LinearApolloSixFrameDisplayRenderFeatures' },
        ),
      )
    },
  }))
}

export type LinearApolloSixFrameDisplayRenderingModel = ReturnType<
  typeof renderingModelIntermediateFactory
>
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearApolloSixFrameDisplayRendering
  extends Instance<LinearApolloSixFrameDisplayRenderingModel> {}
