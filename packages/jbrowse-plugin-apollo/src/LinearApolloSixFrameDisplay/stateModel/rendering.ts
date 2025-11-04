/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import {
  defaultCodonTable,
  doesIntersect2,
  getFrame,
  revcom,
} from '@jbrowse/core/util'
import { type Instance, addDisposer, types } from '@jbrowse/mobx-state-tree'
import { type Theme, createTheme } from '@mui/material'
import { autorun } from 'mobx'

import type { ApolloSessionModel } from '../../session'
import { codonColorCode } from '../../util/displayUtils'
import { looksLikeGene } from '../../util/glyphUtils'

import { layoutsModelFactory } from './layouts'

function drawCodon(
  ctx: CanvasRenderingContext2D,
  codon: string,
  leftPx: number,
  index: number,
  theme: Theme,
  highContrast: boolean,
  bpPerPx: number,
  bp: number,
  rowHeight: number,
  showFeatureLabels: boolean,
  showStartCodons: boolean,
  showStopCodons: boolean,
) {
  const frameOffsets = (
    showFeatureLabels ? [0, 4, 2, 0, 14, 12, 10] : [0, 2, 1, 0, 7, 6, 5]
  ).map((b) => b * rowHeight)
  const strands = [-1, 1] as const
  for (const strand of strands) {
    const frame = getFrame(bp, bp + 3, strand, 0)
    const top = frameOffsets.at(frame)
    if (top === undefined) {
      continue
    }
    const left = Math.round(leftPx + index / bpPerPx)
    const width = Math.round(3 / bpPerPx) === 0 ? 1 : Math.round(3 / bpPerPx)
    const codonCode = strand === 1 ? codon : revcom(codon)
    const aminoAcidCode =
      defaultCodonTable[codonCode as keyof typeof defaultCodonTable]
    const fillColor = codonColorCode(aminoAcidCode, theme, highContrast)
    if (
      fillColor &&
      ((showStopCodons && aminoAcidCode == '*') ||
        (showStartCodons && aminoAcidCode != '*'))
    ) {
      ctx.fillStyle = fillColor
      ctx.fillRect(left, top, width, rowHeight)
    }
  }
}

export function renderingModelFactory(
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
      apolloRowHeight: 20,
      detailsMinHeight: 200,
      detailsHeight: 200,
      lastRowTooltipBufferHeight: 120,
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
            { name: 'LinearApolloSixFrameDisplayRenderCollaborators' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const {
                apolloRowHeight,
                canvas,
                featureLayouts,
                featuresHeight,
                lgv,
                session,
                theme,
                showFeatureLabels,
                showStartCodons,
                showStopCodons,
              } = self
              if (!lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              const { bpPerPx, offsetPx, displayedRegions, dynamicBlocks } = lgv

              const ctx = canvas?.getContext('2d')
              if (!ctx) {
                return
              }
              ctx.clearRect(0, 0, dynamicBlocks.totalWidthPx, featuresHeight)

              for (const [idx, featureLayout] of featureLayouts.entries()) {
                const displayedRegion = displayedRegions[idx]
                for (const [row, featureLayoutRow] of featureLayout.entries()) {
                  for (const { feature } of featureLayoutRow) {
                    if (!looksLikeGene(feature, self.session)) {
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

              if (showStartCodons || showStopCodons) {
                const { apolloDataStore } = session
                for (const block of dynamicBlocks.contentBlocks) {
                  const assembly = apolloDataStore.assemblies.get(
                    block.assemblyName,
                  )
                  const ref = assembly?.getByRefName(block.refName)
                  const roundedStart = Math.floor(block.start)
                  const roundedEnd = Math.ceil(block.end)
                  let seq = ref?.getSequence(roundedStart, roundedEnd)
                  if (!seq) {
                    break
                  }
                  seq = seq.toUpperCase()
                  const baseOffsetPx = (block.start - roundedStart) / bpPerPx
                  const seqLeftPx = Math.round(
                    block.offsetPx - offsetPx - baseOffsetPx,
                  )
                  for (let i = 0; i < seq.length; i++) {
                    const bp = roundedStart + i
                    const codon = seq.slice(i, i + 3)
                    drawCodon(
                      ctx,
                      codon,
                      seqLeftPx,
                      i,
                      theme,
                      true,
                      bpPerPx,
                      bp,
                      apolloRowHeight,
                      showFeatureLabels,
                      showStartCodons,
                      showStopCodons,
                    )
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
  typeof renderingModelFactory
>
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearApolloSixFrameDisplayRendering
  extends Instance<LinearApolloSixFrameDisplayRenderingModel> {}
