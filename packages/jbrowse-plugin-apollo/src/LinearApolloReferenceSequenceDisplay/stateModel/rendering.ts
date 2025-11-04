/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type PluginManager from '@jbrowse/core/PluginManager'
import { type AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { type Theme, createTheme } from '@mui/material'
import { autorun } from 'mobx'
import { type Instance, addDisposer } from 'mobx-state-tree'

import { drawSequenceOverlay } from '../drawSequenceOverlay'
import { drawSequenceTrack } from '../drawSequenceTrack'

import { baseModelFactory } from './base'

export function renderingModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const BaseLinearApolloReferenceSequenceDisplay = baseModelFactory(
    pluginManager,
    configSchema,
  )

  return BaseLinearApolloReferenceSequenceDisplay.named(
    'LinearApolloReferenceSequenceDisplayRendering',
  )
    .volatile(() => ({
      seqTrackCanvas: null as HTMLCanvasElement | null,
      seqTrackOverlayCanvas: null as HTMLCanvasElement | null,
      theme: createTheme(),
    }))
    .actions((self) => ({
      setSeqTrackCanvas(canvas: HTMLCanvasElement | null) {
        self.seqTrackCanvas = canvas
      },
      setSeqTrackOverlayCanvas(canvas: HTMLCanvasElement | null) {
        self.seqTrackOverlayCanvas = canvas
      },
      setTheme(theme: Theme) {
        self.theme = theme
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              const {
                lgv,
                seqTrackCanvas,
                theme,
                highContrast,
                showStartCodons,
                showStopCodons,
                sequenceRowHeight,
                session,
              } = self
              if (
                !lgv.initialized ||
                self.regionCannotBeRendered() ||
                !seqTrackCanvas
              ) {
                return
              }

              const trnslWidthPx = 3 / lgv.bpPerPx
              if (trnslWidthPx < 1) {
                return
              }

              const { bpPerPx, offsetPx, dynamicBlocks } = lgv
              // we have to be really explicit about passing in individual
              // variables here and not just e.g. "lgv" so that the autorun
              // tracks the variables correctly
              drawSequenceTrack(
                seqTrackCanvas,
                theme,
                bpPerPx,
                offsetPx,
                dynamicBlocks,
                highContrast,
                showStartCodons,
                showStopCodons,
                sequenceRowHeight,
                session,
              )
            },
            { name: 'LinearApolloReferenceSequenceDisplayRenderSequence' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const { seqTrackOverlayCanvas } = self
              if (
                !self.lgv.initialized ||
                self.regionCannotBeRendered() ||
                !seqTrackOverlayCanvas
              ) {
                return
              }
              const seqTrackOverlayctx = seqTrackOverlayCanvas.getContext('2d')
              if (!seqTrackOverlayctx) {
                return
              }

              seqTrackOverlayctx.clearRect(
                0,
                0,
                self.lgv.dynamicBlocks.totalWidthPx,
                self.height,
              )

              const {
                hoveredFeature,
                selectedFeature,
                lgv,
                sequenceRowHeight,
                session,
                theme,
              } = self

              if (!(hoveredFeature || selectedFeature)) {
                return
              }
              const { bpPerPx, dynamicBlocks, offsetPx } = lgv
              // we have to be really explicit about passing in individual
              // variables here and not just e.g. "lgv" so that the autorun
              // tracks the variables correctly
              drawSequenceOverlay(
                seqTrackOverlayCanvas,
                seqTrackOverlayctx,
                hoveredFeature,
                selectedFeature,
                sequenceRowHeight,
                theme,
                session,
                bpPerPx,
                offsetPx,
                dynamicBlocks,
              )
            },
            {
              name: 'LinearApolloReferenceSequenceDisplayRenderSequenceHighlight',
            },
          ),
        )
      },
    }))
}

export type LinearApolloReferenceSequenceDisplayRenderingModel = ReturnType<
  typeof renderingModelFactory
>
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearApolloReferenceSequenceDisplayRendering
  extends Instance<LinearApolloReferenceSequenceDisplayRenderingModel> {}
