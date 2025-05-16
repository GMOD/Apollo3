import { type AnnotationFeature } from '@apollo-annotation/mst'
import { splitStringIntoChunks } from '@apollo-annotation/shared'
import { defaultCodonTable, revcom } from '@jbrowse/core/util'
import {
  Button,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  useTheme,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useRef, useState } from 'react'

import { type ApolloSessionModel } from '../session'

const SEQUENCE_WRAP_LENGTH = 60

type SegmentType =
  | 'upOrDownstream'
  | 'UTR'
  | 'CDS'
  | 'intron'
  | 'protein'
  | 'exon'
type SegmentListType = 'CDS' | 'cDNA' | 'genomic' | 'protein'

interface SequenceSegment {
  type: SegmentType
  sequenceLines: string[]
  locs: { min: number; max: number }[]
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
          segments.push({
            type,
            sequenceLines,
            locs: [{ min: loc.min, max: loc.max }],
          })
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
          previousSegment.locs.push({ min: loc.min, max: loc.max })
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
            locs: [{ min: loc.min, max: loc.max }],
          })
        }
      }
      return segments
    }
    case 'CDS': {
      let wholeSequence = ''
      const [firstLocation] = cdsLocations
      const locs: { min: number; max: number }[] = []
      for (const loc of firstLocation) {
        let sequence = getSequence(loc.min, loc.max)
        if (strand === -1) {
          sequence = revcom(sequence)
        }
        wholeSequence += sequence
        locs.push({ min: loc.min, max: loc.max })
      }
      const sequenceLines = splitStringIntoChunks(
        wholeSequence,
        SEQUENCE_WRAP_LENGTH,
      )
      segments.push({ type: 'CDS', sequenceLines, locs })
      return segments
    }
    case 'protein': {
      let wholeSequence = ''
      const [firstLocation] = cdsLocations
      const locs: { min: number; max: number }[] = []
      for (const loc of firstLocation) {
        let sequence = getSequence(loc.min, loc.max)
        if (strand === -1) {
          sequence = revcom(sequence)
        }
        wholeSequence += sequence
        locs.push({ min: loc.min, max: loc.max })
      }
      let protein = ''
      for (let i = 0; i < wholeSequence.length; i += 3) {
        const codonSeq: string = wholeSequence.slice(i, i + 3).toUpperCase()
        protein +=
          defaultCodonTable[codonSeq as keyof typeof defaultCodonTable] || '&'
      }
      const sequenceLines = splitStringIntoChunks(protein, SEQUENCE_WRAP_LENGTH)
      segments.push({ type: 'protein', sequenceLines, locs })
      return segments
    }
  }
}

function getSegmentColor(type: SegmentType) {
  switch (type) {
    case 'upOrDownstream': {
      return 'rgb(255,255,255)'
    }
    case 'exon':
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

function getLocationIntervals(seqSegments: SequenceSegment[]) {
  const locIntervals: { min: number; max: number }[] = []
  const allLocs = seqSegments.flatMap((segment) => segment.locs)
  let [previous] = allLocs
  for (let i = 1; i < allLocs.length; i++) {
    if (previous.min === allLocs[i].max || previous.max === allLocs[i].min) {
      previous = {
        min: Math.min(previous.min, allLocs[i].min),
        max: Math.max(previous.max, allLocs[i].max),
      }
    } else {
      locIntervals.push(previous)
      previous = allLocs[i]
    }
  }
  locIntervals.push(previous)
  return locIntervals
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
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager

  const defaultSelectedOption: SegmentListType = 'genomic'
  const defaultSequenceOptions: SegmentListType[] = ['genomic', 'cDNA']
  const [sequenceOptions, setSequenceOptions] = useState<SegmentListType[]>(
    defaultSequenceOptions,
  )
  const [selectedOption, setSelectedOption] = useState<SegmentListType>(
    defaultSelectedOption,
  )
  const [sequenceSegments, setSequenceSegments] = useState<SequenceSegment[]>(
    () => {
      return refData
        ? getSequenceSegments(
            defaultSelectedOption,
            feature,
            (min: number, max: number) => refData.getSequence(min, max),
          )
        : []
    },
  )
  const [locationIntervals, setLocationIntervals] = useState<
    { min: number; max: number }[]
  >(() => {
    return getLocationIntervals(sequenceSegments)
  })
  const theme = useTheme()
  const seqRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { cdsLocations } = feature
    const [firstLocation] = cdsLocations
    if (firstLocation.length > 0) {
      setSequenceOptions([...defaultSequenceOptions, 'CDS', 'protein'])
    } else {
      setSequenceOptions(defaultSequenceOptions)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature])

  if (!(currentAssembly && refData)) {
    return null
  }
  const refSeq = currentAssembly.getByRefName(refName)
  if (!refSeq) {
    return null
  }
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  if (!featureTypeOntology.isTypeOf(feature.type, 'transcript')) {
    return null
  }

  function handleChangeSeqOption(e: SelectChangeEvent) {
    const option = e.target.value
    setSelectedOption(option as SegmentListType)

    const seqSegments = refData
      ? getSequenceSegments(
          option as SegmentListType,
          feature,
          (min: number, max: number) => refData.getSequence(min, max),
        )
      : []
    const locIntervals: { min: number; max: number }[] =
      getLocationIntervals(seqSegments)
    setSequenceSegments(seqSegments)
    setLocationIntervals(locIntervals)
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

  return (
    <>
      <Select
        defaultValue="genomic"
        value={selectedOption}
        onChange={handleChangeSeqOption}
        size="small"
      >
        {sequenceOptions.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
      <Button
        variant="contained"
        onClick={copyToClipboard}
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
        &gt;{refSeq.name}:
        {locationIntervals
          .map((interval) =>
            feature.strand === 1
              ? `${interval.min + 1}-${interval.max}`
              : `${interval.max}-${interval.min + 1}`,
          )
          .join(';')}
        ({feature.strand === 1 ? '+' : '-'})
        <br />
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
    </>
  )
})
export default TranscriptSequence
