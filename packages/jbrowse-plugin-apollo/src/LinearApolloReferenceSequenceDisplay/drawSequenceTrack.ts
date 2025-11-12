import { defaultCodonTable, getFrame, revcom } from '@jbrowse/core/util'
import { type BlockSet } from '@jbrowse/core/util/blockTypes'
import { type Theme } from '@mui/material'

import { type ApolloSessionModel } from '../session'
import { codonColorCode, colorCode } from '../util/displayUtils'

function drawLetter(
  seqTrackctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  letter: string,
) {
  const fontSize = Math.min(width, 10)
  seqTrackctx.fillStyle = '#000'
  seqTrackctx.font = `${fontSize}px`
  const textWidth = seqTrackctx.measureText(letter).width
  const textX = left + (width - textWidth) / 2
  seqTrackctx.fillText(letter, textX, top + 10)
}

function drawTranslationFrameBackgrounds(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  bpPerPx: number,
  theme: Theme,
  dynamicBlocks: BlockSet,
  highContrast: boolean,
  sequenceRowHeight: number,
) {
  const frames =
    bpPerPx <= 1 ? [3, 2, 1, 0, 0, -1, -2, -3] : [3, 2, 1, -1, -2, -3]
  for (const [idx, frame] of frames.entries()) {
    const frameColor = theme.palette.framesCDS.at(frame)?.main
    if (!frameColor) {
      continue
    }
    const top = idx * sequenceRowHeight
    const { offsetPx } = dynamicBlocks
    const left = Math.max(0, -offsetPx)
    const width = dynamicBlocks.totalWidthPx
    ctx.fillStyle = highContrast ? theme.palette.background.default : frameColor
    ctx.fillRect(left, top, width, sequenceRowHeight)
    if (highContrast) {
      // eslint-disable-next-line prefer-destructuring
      ctx.strokeStyle = theme.palette.grey[200]
      ctx.strokeRect(left, top, width, sequenceRowHeight)
    }
  }
  // allows inter-region padding lines to show through
  for (const block of dynamicBlocks.getBlocks()) {
    if (block.type === 'InterRegionPaddingBlock') {
      const left = block.offsetPx - dynamicBlocks.offsetPx
      ctx.clearRect(left, 0, block.widthPx, canvas.height)
    }
  }
}

function drawBase(
  ctx: CanvasRenderingContext2D,
  base: string,
  index: number,
  leftPx: number,
  bpPerPx: number,
  rowHeight: number,
  theme: Theme,
) {
  const width = 1 / bpPerPx
  if (width < 1) {
    return
  }
  const left = leftPx + index / bpPerPx
  const strands = [-1, 1] as const
  for (const strand of strands) {
    const top = (strand === 1 ? 3 : 4) * rowHeight
    const baseCode = strand === 1 ? base : revcom(base)
    ctx.fillStyle = colorCode(baseCode, theme)
    ctx.fillRect(left, top, width, rowHeight)
    if (1 / bpPerPx >= 12) {
      ctx.strokeStyle = theme.palette.text.disabled
      ctx.strokeRect(left, top, width, rowHeight)
      drawLetter(ctx, left, top, width, baseCode)
    }
  }
}

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
  showStartCodons: boolean,
  showStopCodons: boolean,
) {
  const frameOffsets = (
    bpPerPx <= 1 ? [0, 2, 1, 0, 7, 6, 5] : [0, 2, 1, 0, 5, 4, 3]
  ).map((b) => b * rowHeight)
  const strands = [-1, 1] as const
  for (const strand of strands) {
    const frame = getFrame(bp, bp + 3, strand, 0)
    const top = frameOffsets.at(frame)
    if (top === undefined) {
      continue
    }
    const left = Math.round(leftPx + index / bpPerPx)
    const width = Math.round(3 / bpPerPx)
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
    if (1 / bpPerPx >= 4) {
      ctx.strokeStyle = theme.palette.text.disabled
      ctx.strokeRect(left, top, width, rowHeight)
      drawLetter(ctx, left, top, width, aminoAcidCode)
    }
  }
}

export function drawSequenceTrack(
  canvas: HTMLCanvasElement,
  theme: Theme,
  bpPerPx: number,
  offsetPx: number,
  dynamicBlocks: BlockSet,
  highContrast: boolean,
  showStartCodons: boolean,
  showStopCodons: boolean,
  sequenceRowHeight: number,
  session: ApolloSessionModel,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  drawTranslationFrameBackgrounds(
    canvas,
    ctx,
    bpPerPx,
    theme,
    dynamicBlocks,
    highContrast,
    sequenceRowHeight,
  )

  const { apolloDataStore } = session
  for (const block of dynamicBlocks.contentBlocks) {
    const assembly = apolloDataStore.assemblies.get(block.assemblyName)
    const ref = assembly?.getByRefName(block.refName)
    const roundedStart = Math.floor(block.start)
    const roundedEnd = Math.ceil(block.end)
    let seq = ref?.getSequence(roundedStart, roundedEnd)
    if (!seq) {
      return
    }
    seq = seq.toUpperCase()
    const baseOffsetPx = (block.start - roundedStart) / bpPerPx
    const seqLeftPx = Math.round(block.offsetPx - offsetPx - baseOffsetPx)
    for (let i = 0; i < seq.length; i++) {
      const bp = roundedStart + i
      const codon = seq.slice(i, i + 3)
      drawBase(ctx, seq[i], i, seqLeftPx, bpPerPx, sequenceRowHeight, theme)
      if (codon.length !== 3) {
        continue
      }
      drawCodon(
        ctx,
        codon,
        seqLeftPx,
        i,
        theme,
        highContrast,
        bpPerPx,
        bp,
        sequenceRowHeight,
        showStartCodons,
        showStopCodons,
      )
    }
  }
}
