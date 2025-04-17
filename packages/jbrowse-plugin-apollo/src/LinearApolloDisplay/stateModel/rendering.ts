/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { defaultCodonTable, doesIntersect2, revcom } from '@jbrowse/core/util'
import { Theme } from '@mui/material'
import { autorun } from 'mobx'
import { Instance, addDisposer } from 'mobx-state-tree'

import { ApolloSessionModel } from '../../session'
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
      seqTrackOverlayCanvas: null as HTMLCanvasElement | null,
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

function colorCode(letter: string, theme?: Theme) {
  return (
    theme?.palette.bases[
      letter.toUpperCase() as keyof Theme['palette']['bases']
    ].main.toString() ?? 'lightgray'
  )
}

function codonColorCode(letter: string, highContrast?: boolean) {
  const colorMap: Record<string, string | undefined> = {
    M: '#33ee33',
    '*': highContrast ? '#000000' : '#f44336',
  }

  return colorMap[letter.toUpperCase()]
}

function reverseCodonSeq(seq: string): string {
  // disable because sequence is all ascii
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  return [...seq]
    .map((c) => revcom(c))
    .reverse()
    .join('')
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
  seqTrackctx.font = `${fontSize}px`
  const textWidth = seqTrackctx.measureText(letter).width
  const textX = startPx + (widthPx - textWidth) / 2
  seqTrackctx.fillText(letter, textX, textY + 10)
}

function drawTranslation(
  seqTrackctx: CanvasRenderingContext2D,
  bpPerPx: number,
  trnslStartPx: number,
  trnslY: number,
  trnslWidthPx: number,
  sequenceRowHeight: number,
  seq: string,
  i: number,
  reverse: boolean,
  showStartCodons: boolean,
  showStopCodons: boolean,
  highContrast: boolean,
) {
  let codonSeq: string = seq.slice(i, i + 3).toUpperCase()
  if (reverse) {
    codonSeq = reverseCodonSeq(codonSeq)
  }
  const codonLetter =
    defaultCodonTable[codonSeq as keyof typeof defaultCodonTable]
  if (!codonLetter) {
    return
  }
  if (!showStopCodons && codonLetter == '*') {
    return
  }
  if (!showStartCodons && codonLetter != '*') {
    return
  }
  const fillColor = codonColorCode(codonLetter, highContrast)
  if (fillColor) {
    seqTrackctx.fillStyle = fillColor
    seqTrackctx.fillRect(trnslStartPx, trnslY, trnslWidthPx, sequenceRowHeight)
  }
  if (bpPerPx <= 0.1) {
    seqTrackctx.rect(trnslStartPx, trnslY, trnslWidthPx, sequenceRowHeight)
    seqTrackctx.stroke()
    drawLetter(seqTrackctx, trnslStartPx, trnslWidthPx, codonLetter, trnslY)
  }
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
          async () => {
            // TODO: Find better way of forcing autorun to trigger than console.warn
            console.warn(self.showStartCodons)
            console.warn(self.showStopCodons)
            const { theme } = self
            if (!self.lgv.initialized || self.regionCannotBeRendered()) {
              return
            }
            const trnslWidthPx = 3 / self.lgv.bpPerPx
            if (trnslWidthPx < 1) {
              return
            }
            const seqTrackctx = self.seqTrackCanvas?.getContext('2d')
            if (!seqTrackctx) {
              return
            }

            seqTrackctx.clearRect(
              0,
              0,
              self.lgv.dynamicBlocks.totalWidthPx,
              self.lgv.bpPerPx <= 1 ? 125 : 95,
            )
            const frames =
              self.lgv.bpPerPx <= 1
                ? [3, 2, 1, 0, 0, -1, -2, -3]
                : [3, 2, 1, -1, -2, -3]
            let height = 0
            if (theme) {
              for (const frame of frames) {
                let frameColor = theme.palette.framesCDS.at(frame)?.main
                if (frameColor) {
                  let offsetPx = 0
                  if (self.highContrast) {
                    frameColor = 'white'
                    offsetPx = 1
                    // eslint-disable-next-line prefer-destructuring
                    seqTrackctx.fillStyle = theme.palette.grey[200]
                    seqTrackctx.fillRect(
                      0,
                      height,
                      self.lgv.dynamicBlocks.totalWidthPx,
                      self.sequenceRowHeight,
                    )
                  }
                  seqTrackctx.fillStyle = frameColor
                  seqTrackctx.fillRect(
                    0 + offsetPx,
                    height + offsetPx,
                    self.lgv.dynamicBlocks.totalWidthPx - 2 * offsetPx,
                    self.sequenceRowHeight - 2 * offsetPx,
                  )
                }
                height += self.sequenceRowHeight
              }
            }

            for (const [idx, region] of self.regions.entries()) {
              const driver = (
                self.session as unknown as ApolloSessionModel
              ).apolloDataStore.getBackendDriver(region.assemblyName)

              if (!driver) {
                throw new Error('Failed to get the backend driver')
              }
              const { seq } = await driver.getSequence(region)

              if (!seq) {
                return
              }
              // disable because sequence is all ascii
              // eslint-disable-next-line @typescript-eslint/no-misused-spread
              for (const [i, letter] of [...seq].entries()) {
                const trnslXOffset =
                  (self.lgv.bpToPx({
                    refName: region.refName,
                    coord: region.start + i,
                    regionNumber: idx,
                  })?.offsetPx ?? 0) - self.lgv.offsetPx
                const trnslStartPx = self.lgv.displayedRegions[idx].reversed
                  ? trnslXOffset - trnslWidthPx
                  : trnslXOffset

                // Draw translation forward
                for (let j = 2; j >= 0; j--) {
                  if ((region.start + i) % 3 === j) {
                    drawTranslation(
                      seqTrackctx,
                      self.lgv.bpPerPx,
                      trnslStartPx,
                      self.sequenceRowHeight * (2 - j),
                      trnslWidthPx,
                      self.sequenceRowHeight,
                      seq,
                      i,
                      false,
                      self.showStartCodons,
                      self.showStopCodons,
                      self.highContrast,
                    )
                  }
                }

                if (self.lgv.bpPerPx <= 1) {
                  const xOffset =
                    (self.lgv.bpToPx({
                      refName: region.refName,
                      coord: region.start + i,
                      regionNumber: idx,
                    })?.offsetPx ?? 0) - self.lgv.offsetPx
                  const widthPx = 1 / self.lgv.bpPerPx
                  const startPx = self.lgv.displayedRegions[idx].reversed
                    ? xOffset - widthPx
                    : xOffset

                  // Draw forward
                  seqTrackctx.beginPath()
                  seqTrackctx.fillStyle = colorCode(letter, self.theme)
                  seqTrackctx.rect(
                    startPx,
                    self.sequenceRowHeight * 3,
                    widthPx,
                    self.sequenceRowHeight,
                  )
                  seqTrackctx.fill()
                  if (self.lgv.bpPerPx <= 0.1) {
                    seqTrackctx.stroke()
                    drawLetter(
                      seqTrackctx,
                      startPx,
                      widthPx,
                      letter,
                      self.sequenceRowHeight * 3,
                    )
                  }

                  // Draw reverse
                  const revLetter = revcom(letter)
                  seqTrackctx.beginPath()
                  seqTrackctx.fillStyle = colorCode(revLetter, self.theme)
                  seqTrackctx.rect(
                    startPx,
                    self.sequenceRowHeight * 4,
                    widthPx,
                    self.sequenceRowHeight,
                  )
                  seqTrackctx.fill()
                  if (self.lgv.bpPerPx <= 0.1) {
                    seqTrackctx.stroke()
                    drawLetter(
                      seqTrackctx,
                      startPx,
                      widthPx,
                      revLetter,
                      self.sequenceRowHeight * 4,
                    )
                  }
                }

                // Draw translation reverse
                for (let k = 0; k <= 2; k++) {
                  const rowOffset = self.lgv.bpPerPx <= 1 ? 5 : 3
                  if ((region.start + i) % 3 === k) {
                    drawTranslation(
                      seqTrackctx,
                      self.lgv.bpPerPx,
                      trnslStartPx,
                      self.sequenceRowHeight * (rowOffset + k),
                      trnslWidthPx,
                      self.sequenceRowHeight,
                      seq,
                      i,
                      true,
                      self.showStartCodons,
                      self.showStopCodons,
                      self.highContrast,
                    )
                  }
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
                for (const [featureRow, featureId] of featureLayoutRow) {
                  const feature = self.getAnnotationFeatureById(featureId)
                  if (featureRow > 0 || !feature) {
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
                  self.getGlyph(feature).draw(ctx, feature, row, self, idx)
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
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearApolloDisplayRendering
  extends Instance<LinearApolloDisplayRenderingModel> {}
