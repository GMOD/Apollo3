import { splitStringIntoChunks } from '@apollo-annotation/shared'
import { Button, Paper, useTheme } from '@mui/material'
import React, { useRef } from 'react'

import { copyToClipboard } from '../util/copyToClipboard'
import {
  type SequenceSegment,
  getSegmentColor,
  getSequenceLength,
} from './sequenceSegments'

function wrapSequence(
  segments: SequenceSegment[],
  sequenceWrapLength: number,
  getContrastText: (color: string) => string,
): React.ReactNode[] {
  const seqElements: React.ReactNode[] = []
  let processedChars = 0
  for (const [index, segment] of segments.entries()) {
    const lastLineLength = processedChars % sequenceWrapLength
    const segmentLineBreak =
      processedChars > 0 && lastLineLength === 0 ? '\n' : ''
    processedChars += segment.sequence.length
    const firstLineContent = segment.sequence.slice(
      0,
      sequenceWrapLength - lastLineLength,
    )
    const firstLine = segmentLineBreak + firstLineContent
    const remainingLines = splitStringIntoChunks(
      segment.sequence.slice(firstLineContent.length),
      sequenceWrapLength,
    )
    const printLines = [firstLine, ...remainingLines]

    const color = getSegmentColor(segment.type)
    const style: React.CSSProperties = { whiteSpace: 'pre-line' }
    if (color) {
      style.background = color
      style.color = getContrastText(color)
    }
    const span = (
      <span key={`${segment.type}-${index}`} style={style}>
        {printLines.join('\n')}
      </span>
    )
    seqElements.push(span)
  }
  return seqElements
}

const SEQUENCE_WRAP_LENGTH = 60

export function SequenceViewer({
  locationIntervals,
  refSeqName,
  sequenceSegments,
  strand,
}: {
  refSeqName: string
  strand: 1 | -1
  locationIntervals: { min: number; max: number }[]
  sequenceSegments: SequenceSegment[]
}) {
  const theme = useTheme()
  const seqRef = useRef<HTMLDivElement>(null)

  function onCopyClick() {
    const seqDiv = seqRef.current
    if (!seqDiv) {
      return
    }
    void copyToClipboard(seqDiv)
  }

  return (
    <>
      <Button
        variant="contained"
        onClick={onCopyClick}
        style={{ marginLeft: 10 }}
        size="medium"
      >
        Copy sequence
      </Button>
      <Paper
        style={{
          fontFamily: 'monospace',
          padding: theme.spacing(),
          overflowX: 'auto',
        }}
        ref={seqRef}
      >
        &gt;{refSeqName}:
        {locationIntervals
          .map((interval) =>
            strand === 1
              ? `${interval.min + 1}-${interval.max}`
              : `${interval.max}-${interval.min + 1}`,
          )
          .join(';')}
        (strand={strand === 1 ? '+' : '-'};length=
        {getSequenceLength(sequenceSegments)})
        <br />
        {wrapSequence(sequenceSegments, SEQUENCE_WRAP_LENGTH, (color) =>
          theme.palette.getContrastText(color),
        )}
      </Paper>
    </>
  )
}
export default SequenceViewer
