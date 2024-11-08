import { AnnotationFeature } from '@apollo-annotation/mst'
import { splitStringIntoChunks } from '@apollo-annotation/shared'
import { revcom } from '@jbrowse/core/util'
import {
  Button,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Typography,
  useTheme,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useRef, useState } from 'react'

import { ApolloSessionModel } from '../session'

const SEQUENCE_WRAP_LENGTH = 60

type SegmentType = 'upOrDownstream' | 'UTR' | 'CDS' | 'intron' | 'protein'
type SegmentListType = 'CDS' | 'cDNA' | 'genomic'

interface SequenceSegment {
  type: SegmentType
  sequenceLines: string[]
}

function getSequenceSegments(
  segmentType: SegmentListType,
  feature: AnnotationFeature,
  getSequence: (min: number, max: number) => string,
) {
  const segments: SequenceSegment[] = []
  const { cdsLocations, strand, transcriptParts } = feature
  switch (segmentType) {
    case 'genomic':
    case 'cDNA': {
      const [firstLocation] = transcriptParts
      for (const loc of firstLocation) {
        if (segmentType === 'cDNA' && loc.type === 'intron') {
          continue
        }
        let sequence = getSequence(loc.min, loc.max)
        if (strand === -1) {
          sequence = revcom(sequence)
        }
        const type: SegmentType =
          loc.type === 'fivePrimeUTR' || loc.type === 'threePrimeUTR'
            ? 'UTR'
            : loc.type
        const previousSegment = segments.at(-1)
        if (!previousSegment) {
          const sequenceLines = splitStringIntoChunks(
            sequence,
            SEQUENCE_WRAP_LENGTH,
          )
          segments.push({ type, sequenceLines })
          continue
        }
        if (previousSegment.type === type) {
          const [previousSegmentFirstLine, ...previousSegmentFollowingLines] =
            previousSegment.sequenceLines
          const newSequence = previousSegmentFollowingLines.join('') + sequence
          previousSegment.sequenceLines = [
            previousSegmentFirstLine,
            ...splitStringIntoChunks(newSequence, SEQUENCE_WRAP_LENGTH),
          ]
        } else {
          const count = segments.reduce(
            (accumulator, currentSegment) =>
              accumulator +
              currentSegment.sequenceLines.reduce(
                (subAccumulator, currentLine) =>
                  subAccumulator + currentLine.length,
                0,
              ),
            0,
          )
          const previousLineLength = count % SEQUENCE_WRAP_LENGTH
          const newSegmentFirstLineLength =
            SEQUENCE_WRAP_LENGTH - previousLineLength
          const newSegmentFirstLine = sequence.slice(
            0,
            newSegmentFirstLineLength,
          )
          const newSegmentRemainderLines = splitStringIntoChunks(
            sequence.slice(newSegmentFirstLineLength),
            SEQUENCE_WRAP_LENGTH,
          )
          segments.push({
            type,
            sequenceLines: [newSegmentFirstLine, ...newSegmentRemainderLines],
          })
        }
      }
      return segments
    }
    case 'CDS': {
      let wholeSequence = ''
      const [firstLocation] = cdsLocations
      for (const loc of firstLocation) {
        let sequence = getSequence(loc.min, loc.max)
        if (strand === -1) {
          sequence = revcom(sequence)
        }
        wholeSequence += sequence
      }
      const sequenceLines = splitStringIntoChunks(
        wholeSequence,
        SEQUENCE_WRAP_LENGTH,
      )
      segments.push({ type: 'CDS', sequenceLines })
      return segments
    }
  }
}

function getSegmentColor(type: SegmentType) {
  switch (type) {
    case 'upOrDownstream': {
      return 'rgb(255,255,255)'
    }
    case 'UTR': {
      return 'rgb(194,106,119)'
    }
    case 'CDS': {
      return 'rgb(93,168,153)'
    }
    case 'intron': {
      return 'rgb(187,187,187)'
    }
    case 'protein': {
      return 'rgb(148,203,236)'
    }
  }
}

export const TranscriptSequence = observer(function TranscriptSequence({
  assembly,
  feature,
  refName,
  session,
}: {
  assembly: string
  feature: AnnotationFeature
  refName: string
  session: ApolloSessionModel
}) {
  const currentAssembly = session.apolloDataStore.assemblies.get(assembly)
  const refData = currentAssembly?.getByRefName(refName)
  const [showSequence, setShowSequence] = useState(false)
  const [selectedOption, setSelectedOption] = useState<SegmentListType>('CDS')
  const theme = useTheme()
  const seqRef = useRef<HTMLDivElement>(null)

  if (!(currentAssembly && refData)) {
    return null
  }
  const refSeq = currentAssembly.getByRefName(refName)
  if (!refSeq) {
    return null
  }
  if (feature.type !== 'mRNA') {
    return null
  }

  const handleSeqButtonClick = () => {
    setShowSequence(!showSequence)
  }

  function handleChangeSeqOption(e: SelectChangeEvent) {
    const option = e.target.value
    setSelectedOption(option as SegmentListType)
  }

  // Function to copy text to clipboard
  const copyToClipboard = () => {
    const seqDiv = seqRef.current
    if (!seqDiv) {
      return
    }
    const textBlob = new Blob([seqDiv.outerText], { type: 'text/plain' })
    const htmlBlob = new Blob([seqDiv.outerHTML], { type: 'text/html' })
    const clipboardItem = new ClipboardItem({
      [textBlob.type]: textBlob,
      [htmlBlob.type]: htmlBlob,
    })
    void navigator.clipboard.write([clipboardItem])
  }

  const sequenceSegments = showSequence
    ? getSequenceSegments(selectedOption, feature, (min: number, max: number) =>
        refData.getSequence(min, max),
      )
    : []

  return (
    <>
      <Typography variant="h5">Sequence</Typography>
      <div>
        <Button variant="contained" onClick={handleSeqButtonClick}>
          {showSequence ? 'Hide sequence' : 'Show sequence'}
        </Button>
      </div>
      {showSequence && (
        <>
          <Select
            defaultValue="CDS"
            value={selectedOption}
            onChange={handleChangeSeqOption}
          >
            <MenuItem value="CDS">CDS</MenuItem>
            <MenuItem value={'cDNA'}>cDNA</MenuItem>
            <MenuItem value={'genomic'}>Genomic</MenuItem>
          </Select>
          <Paper
            style={{
              fontFamily: 'monospace',
              padding: theme.spacing(),
              overflowX: 'auto',
            }}
            ref={seqRef}
          >
            {sequenceSegments.map((segment, index) => (
              <span
                key={`${segment.type}-${index}`}
                style={{
                  background: getSegmentColor(segment.type),
                  color: theme.palette.getContrastText(
                    getSegmentColor(segment.type),
                  ),
                }}
              >
                {segment.sequenceLines.map((sequenceLine, idx) => (
                  <React.Fragment key={`${sequenceLine.slice(0, 5)}-${idx}`}>
                    {sequenceLine}
                    {idx === segment.sequenceLines.length - 1 &&
                    sequenceLine.length !== SEQUENCE_WRAP_LENGTH ? null : (
                      <br />
                    )}
                  </React.Fragment>
                ))}
              </span>
            ))}
          </Paper>
          <Button variant="contained" onClick={copyToClipboard}>
            Copy sequence
          </Button>
        </>
      )}
    </>
  )
})
export default TranscriptSequence
