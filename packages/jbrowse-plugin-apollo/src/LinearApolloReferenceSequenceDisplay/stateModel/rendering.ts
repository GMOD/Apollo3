/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type PluginManager from '@jbrowse/core/PluginManager'
import { type AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import {
  type Frame,
  defaultCodonTable,
  getFrame,
  revcom,
} from '@jbrowse/core/util'
import { type Theme, createTheme } from '@mui/material'
import { autorun } from 'mobx'
import { type Instance, addDisposer } from 'mobx-state-tree'

import { type ApolloSessionModel } from '../../session'

import { baseModelFactory } from './base'

function colorCode(letter: string, theme: Theme) {
  return (
    theme.palette.bases[
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
  const fillColor = codonColorCode(codonLetter, highContrast)
  if (
    fillColor &&
    ((showStopCodons && codonLetter == '*') ||
      (showStartCodons && codonLetter != '*'))
  ) {
    seqTrackctx.fillStyle = fillColor
    seqTrackctx.fillRect(trnslStartPx, trnslY, trnslWidthPx, sequenceRowHeight)
  }
  if (bpPerPx <= 0.1) {
    seqTrackctx.rect(trnslStartPx, trnslY, trnslWidthPx, sequenceRowHeight)
    seqTrackctx.stroke()
    drawLetter(seqTrackctx, trnslStartPx, trnslWidthPx, codonLetter, trnslY)
  }
}

function getTranslationRow(frame: Frame, bpPerPx: number) {
  const offset = bpPerPx <= 1 ? 2 : 0
  switch (frame) {
    case 3: {
      return 0
    }
    case 2: {
      return 1
    }
    case 1: {
      return 2
    }
    case -1: {
      return 3 + offset
    }
    case -2: {
      return 4 + offset
    }
    case -3: {
      return 5 + offset
    }
  }
}

function getSeqRow(
  strand: 1 | -1 | undefined,
  bpPerPx: number,
): number | undefined {
  if (bpPerPx > 1 || strand === undefined) {
    return
  }
  return strand === 1 ? 3 : 4
}

function highlightSeq(
  seqTrackOverlayctx: CanvasRenderingContext2D,
  theme: Theme,
  startPx: number,
  sequenceRowHeight: number,
  row: number | undefined,
  widthPx: number,
) {
  if (row !== undefined) {
    seqTrackOverlayctx.fillStyle = theme.palette.action.focus
    seqTrackOverlayctx.fillRect(
      startPx,
      sequenceRowHeight * row,
      widthPx,
      sequenceRowHeight,
    )
  }
}

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
                self.height,
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
                const { apolloDataStore } =
                  self.session as unknown as ApolloSessionModel
                const assembly = apolloDataStore.assemblies.get(
                  region.assemblyName,
                )
                const ref = assembly?.getByRefName(region.refName)
                const seq = ref?.getSequence(region.start, region.end)
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
            { name: 'LinearApolloReferenceSequenceDisplayRenderSequence' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              const seqTrackOverlayctx =
                self.seqTrackOverlayCanvas?.getContext('2d')
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
                lgv,
                regions,
                sequenceRowHeight,
                session,
                theme,
              } = self

              if (!hoveredFeature) {
                return
              }
              const { feature } = hoveredFeature

              const { featureTypeOntology } =
                session.apolloDataStore.ontologyManager
              if (!featureTypeOntology) {
                throw new Error('featureTypeOntology is undefined')
              }
              for (const [idx, region] of regions.entries()) {
                if (featureTypeOntology.isTypeOf(feature.type, 'CDS')) {
                  const parentFeature = feature.parent
                  if (!parentFeature) {
                    continue
                  }
                  const cdsLocs = parentFeature.cdsLocations.find(
                    (loc) =>
                      feature.min === loc.at(0)?.min &&
                      feature.max === loc.at(-1)?.max,
                  )
                  if (!cdsLocs) {
                    continue
                  }
                  for (const dl of cdsLocs) {
                    const frame = getFrame(
                      dl.min,
                      dl.max,
                      feature.strand ?? 1,
                      dl.phase,
                    )
                    const row = getTranslationRow(frame, lgv.bpPerPx)
                    const offset =
                      (lgv.bpToPx({
                        refName: region.refName,
                        coord: dl.min,
                        regionNumber: idx,
                      })?.offsetPx ?? 0) - lgv.offsetPx
                    const widthPx = (dl.max - dl.min) / lgv.bpPerPx
                    const startPx = lgv.displayedRegions[idx].reversed
                      ? offset - widthPx
                      : offset

                    highlightSeq(
                      seqTrackOverlayctx,
                      theme,
                      startPx,
                      sequenceRowHeight,
                      row,
                      widthPx,
                    )
                  }
                } else {
                  const row = getSeqRow(feature.strand, lgv.bpPerPx)
                  const offset =
                    (lgv.bpToPx({
                      refName: region.refName,
                      coord: feature.min,
                      regionNumber: idx,
                    })?.offsetPx ?? 0) - lgv.offsetPx
                  const widthPx = feature.length / lgv.bpPerPx
                  const startPx = lgv.displayedRegions[idx].reversed
                    ? offset - widthPx
                    : offset

                  highlightSeq(
                    seqTrackOverlayctx,
                    theme,
                    startPx,
                    sequenceRowHeight,
                    row,
                    widthPx,
                  )
                }
              }
            },
            { name: 'LinearApolloDisplayRenderSeqHighlight' },
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
