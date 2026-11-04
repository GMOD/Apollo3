import type { AnnotationFeature } from '@apollo-annotation/mst'
import { defaultCodonTable, revcom } from '@jbrowse/core/util'

export type SegmentType =
  | 'upOrDownstream'
  | 'UTR'
  | 'CDS'
  | 'intron'
  | 'protein'
  | 'exon'
  | 'plain'
export type SegmentListType = 'CDS' | 'cDNA' | 'genomic' | 'protein'

export interface SequenceSegment {
  type: SegmentType
  sequence: string
  locs: { min: number; max: number }[]
}

export function getSequenceLength(segments: SequenceSegment[]): number {
  let length = 0
  for (const segment of segments) {
    length += segment.sequence.length
  }
  return length
}

function getCdsSequenceAndLocs(
  feature: AnnotationFeature,
  getSequence: (min: number, max: number) => string,
) {
  const { cdsLocations, strand } = feature
  let wholeSequence = ''
  const [firstLocation] = cdsLocations
  const locs: { min: number; max: number }[] = []
  for (const loc of firstLocation) {
    let locSeq = getSequence(loc.min, loc.max)
    if (strand === -1) {
      locSeq = revcom(locSeq)
    }
    wholeSequence += locSeq
    locs.push({ min: loc.min, max: loc.max })
  }
  return { wholeSequence, locs }
}

export function getSequenceSegments(
  segmentType: SegmentListType,
  feature: AnnotationFeature,
  getSequence: (min: number, max: number) => string,
) {
  const segments: SequenceSegment[] = []
  const { strand, transcriptParts } = feature
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
          segments.push({
            type,
            sequence,
            locs: [{ min: loc.min, max: loc.max }],
          })
          continue
        }
        if (previousSegment.type === type) {
          previousSegment.sequence += sequence
          previousSegment.locs.push({ min: loc.min, max: loc.max })
        } else {
          segments.push({
            type,
            sequence,
            locs: [{ min: loc.min, max: loc.max }],
          })
        }
      }
      return segments
    }
    case 'CDS': {
      const { locs, wholeSequence } = getCdsSequenceAndLocs(
        feature,
        getSequence,
      )
      segments.push({ type: 'CDS', sequence: wholeSequence, locs })
      return segments
    }
    case 'protein': {
      const { locs, wholeSequence } = getCdsSequenceAndLocs(
        feature,
        getSequence,
      )
      let protein = ''
      for (let i = 0; i < wholeSequence.length; i += 3) {
        const codonSeq: string = wholeSequence.slice(i, i + 3).toUpperCase()
        protein += defaultCodonTable[codonSeq] || '&'
      }
      segments.push({ type: 'protein', sequence: protein, locs })
      return segments
    }
  }
}

export function getSegmentColor(type: SegmentType): string | undefined {
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
    case 'plain': {
      return undefined
    }
  }
}

export function getLocationIntervals(seqSegments: SequenceSegment[]) {
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
