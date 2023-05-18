import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { doesIntersect2 } from '@jbrowse/core/util'
import { Theme } from '@mui/material'
import { autorun } from 'mobx'
import { Instance, addDisposer } from 'mobx-state-tree'

import { Collaborator } from '../../session'
import { getGlyph } from './getGlyph'
import { layoutsModelFactory } from './layouts'

export function renderingModelIntermediateFactory(
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
    })
    .volatile(() => ({
      canvas: null as HTMLCanvasElement | null,
      overlayCanvas: null as HTMLCanvasElement | null,
      theme: undefined as Theme | undefined,
    }))
    .views((self) => ({
      get featuresHeight() {
        return (self.highestRow + 1) * self.apolloRowHeight
      },
    }))
    .views((self) => ({
      get detailsHeight() {
        return Math.max(
          self.detailsMinHeight,
          self.height - self.featuresHeight,
        )
      },
    }))
    .actions((self) => ({
      setCanvas(canvas: HTMLCanvasElement | null) {
        self.canvas = canvas
      },
      setOverlayCanvas(canvas: HTMLCanvasElement | null) {
        self.overlayCanvas = canvas
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
              const ctx = self.overlayCanvas?.getContext('2d')
              if (!ctx) {
                return
              }
              for (const collaborator of self.session
                .collaborators as Collaborator[]) {
                const { locations } = collaborator
                if (!locations.length) {
                  continue
                }
                for (const location of locations) {
                  const { start, end, refName } = location
                  const locationStartPxInfo = self.lgv.bpToPx({
                    refName,
                    coord: start,
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
              }
            },
            { name: 'LinearApolloDisplayRenderCollaborators' },
          ),
        )
      },
    }))
}

export function renderingModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LinearApolloDisplayRendering = renderingModelIntermediateFactory(
    pluginManager,
    configSchema,
  )

  return LinearApolloDisplayRendering.actions((self) => ({
    afterAttach() {
      addDisposer(
        self,
        autorun(
          () => {
            if (!self.lgv.initialized || self.regionCannotBeRendered()) {
              return
            }
            const ctx = self.canvas?.getContext('2d')
            if (!ctx) {
              return
            }
            ctx.clearRect(
              0,
              0,
              self.lgv.dynamicBlocks.totalWidthPx,
              self.featuresHeight,
            )
            self.featureLayouts.forEach((featureLayout, idx) => {
              const displayedRegion = self.displayedRegions[idx]
              featureLayout.forEach((featureLayoutRow, row) => {
                featureLayoutRow.forEach(([featureRow, feature]) => {
                  if (featureRow > 0) {
                    return
                  }
                  const x =
                    (self.lgv.bpToPx({
                      refName: displayedRegion.refName,
                      coord: feature.min,
                      regionNumber: idx,
                    })?.offsetPx || 0) - self.lgv.offsetPx
                  const widthPx = (feature.max - feature.min) / self.lgv.bpPerPx
                  if (
                    !doesIntersect2(
                      0,
                      self.lgv.dynamicBlocks.totalWidthPx,
                      x,
                      x + widthPx,
                    )
                  ) {
                    return
                  }

                  getGlyph(feature, self.lgv.bpPerPx).draw(
                    self,
                    ctx,
                    feature,
                    x,
                    row * self.apolloRowHeight,
                    displayedRegion.reversed,
                  )
                })
              })
            })
          },
          { name: 'LinearApolloDisplayRenderFeatures' },
        ),
      )
    },
  }))
}

export type LinearApolloDisplayRenderingModel = ReturnType<
  typeof renderingModelIntermediateFactory
>
export type LinearApolloDisplayRendering =
  Instance<LinearApolloDisplayRenderingModel>
