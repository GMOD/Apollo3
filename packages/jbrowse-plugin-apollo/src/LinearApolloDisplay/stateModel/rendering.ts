import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { doesIntersect2 } from '@jbrowse/core/util'
import { Theme } from '@mui/material'
import { autorun } from 'mobx'
import { Instance, addDisposer } from 'mobx-state-tree'

import { ApolloSessionModel } from '../../session'
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
      sequenceRowHeight: 15,
      apolloRowHeight: 20,
      detailsMinHeight: 200,
      detailsHeight: 200,
      lastRowTooltipBufferHeight: 40,
      isShown: true,
    })
    .volatile(() => ({
      canvas: null as HTMLCanvasElement | null,
      overlayCanvas: null as HTMLCanvasElement | null,
      collaboratorCanvas: null as HTMLCanvasElement | null,
      seqTrackCanvas: null as HTMLCanvasElement | null,
      theme: undefined as Theme | undefined,
    }))
    .views((self) => ({
      get featuresHeight() {
        return (
          (self.highestRow + 1) * self.apolloRowHeight +
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
      setSeqTrackCanvas(canvas: HTMLCanvasElement | null) {
        self.seqTrackCanvas = canvas
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
            { name: 'LinearApolloDisplayRenderCollaborators' },
          ),
        )
      },
    }))
}

function colorCode(letter: string) {
  switch (letter.toUpperCase()) {
    case 'A': {
      return '#4caf50'
    }
    case 'T': {
      return '#f44336'
    }
    case 'C': {
      return '#2196f3'
    }
    case 'G': {
      return '#ff9800'
    }
    default: {
      return 'white'
    }
  }
}

function reverseLetter(letter: string) {
  const letterMappings: Record<string, string> = {
    A: 'T',
    a: 't',
    T: 'A',
    t: 'a',
    C: 'G',
    c: 'g',
    G: 'C',
    g: 'c',
  }
  return letterMappings[letter] || letter
}

function drawLetter(
  seqTrackctx: CanvasRenderingContext2D,
  startPx: number,
  widthPx: number,
  letter: string,
  textY: number,
) {
  const fontSize = Math.min(widthPx, 10)
  seqTrackctx.fillStyle = '#000'
  seqTrackctx.font = `${fontSize}px Arial`
  const textWidth = seqTrackctx.measureText(letter).width
  const textX = startPx + (widthPx - textWidth) / 2
  seqTrackctx.fillText(letter, textX, textY + 10)
}

export function sequenceRenderingModelFactory(
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
            const seqTrackctx = self.seqTrackCanvas?.getContext('2d')
            if (!seqTrackctx) {
              return
            }

            seqTrackctx.clearRect(0, 0, self.lgv.dynamicBlocks.totalWidthPx, 80)
            console.log(`regions = ${JSON.stringify(self.regions)}`)

            for (const [idx, region] of self.regions.entries()) {
              const assembly = (
                self.session as unknown as ApolloSessionModel
              ).apolloDataStore.assemblies.get(region.assemblyName)
              const ref = assembly?.getByRefName(region.refName)
              const seq = ref?.getSequence(region.start, region.end)
              if (seq) {
                console.log(`seq = ${seq}`)
                for (const [i, letter] of [...seq].entries()) {
                  const xOffset =
                    (self.lgv.bpToPx({
                      refName: region.refName,
                      coord: region.start + i,
                      regionNumber: idx,
                    })?.offsetPx ?? 0) - self.lgv.offsetPx
                  const widthPx = 1 / self.lgv.bpPerPx
                  const startPx = self.displayedRegions[idx].reversed
                    ? xOffset - widthPx
                    : xOffset

                  seqTrackctx.beginPath()
                  seqTrackctx.fillStyle = colorCode(letter)
                  seqTrackctx.rect(startPx, 0, widthPx, self.sequenceRowHeight)
                  seqTrackctx.fill()
                  seqTrackctx.stroke()
                  drawLetter(seqTrackctx, startPx, widthPx, letter, 0)

                  const revLetter = reverseLetter(letter)
                  seqTrackctx.beginPath()
                  seqTrackctx.fillStyle = colorCode(revLetter)
                  seqTrackctx.rect(
                    startPx,
                    self.sequenceRowHeight,
                    widthPx,
                    self.sequenceRowHeight,
                  )
                  seqTrackctx.fill()
                  seqTrackctx.stroke()
                  drawLetter(
                    seqTrackctx,
                    startPx,
                    widthPx,
                    revLetter,
                    self.sequenceRowHeight,
                  )
                }
              }
            }
          },
          { name: 'LinearApolloDisplayRenderSequence' },
        ),
      )
    },
  }))
}

export function renderingModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LinearApolloDisplayRendering = sequenceRenderingModelFactory(
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
            for (const [idx, featureLayout] of self.featureLayouts.entries()) {
              const displayedRegion = self.displayedRegions[idx]
              for (const [row, featureLayoutRow] of featureLayout.entries()) {
                for (const [featureRow, feature] of featureLayoutRow) {
                  if (featureRow > 0) {
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
                  const x =
                    (self.lgv.bpToPx({
                      refName: displayedRegion.refName,
                      coord: feature.min,
                      regionNumber: idx,
                    })?.offsetPx ?? 0) - self.lgv.offsetPx
                  getGlyph(feature, self.lgv.bpPerPx).draw(
                    self,
                    ctx,
                    feature,
                    x,
                    row,
                    displayedRegion.reversed,
                  )
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
  typeof renderingModelIntermediateFactory
>
export type LinearApolloDisplayRendering =
  Instance<LinearApolloDisplayRenderingModel>
