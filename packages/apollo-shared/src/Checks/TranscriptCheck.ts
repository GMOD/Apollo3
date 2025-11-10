import { Check } from '@apollo-annotation/common'
import {
  type AnnotationFeatureSnapshot,
  type CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { revcom } from '@jbrowse/core/util'
import ObjectID from 'bson-objectid'

interface SpliceSequence {
  fivePrimeSeq: string
  fivePrimeMin: number
  threePrimeSeq: string
  threePrimeMin: number
}

enum CAUSES {
  'NonCanonicalSpliceSiteAtFivePrime',
  'NonCanonicalSpliceSiteAtThreePrime',
}
const CHECK_NAME = 'TranscriptCheck'

async function getSpliceSequences(
  transcript: AnnotationFeatureSnapshot,
  getSequence: (start: number, end: number) => Promise<string>,
): Promise<SpliceSequence[]> {
  if (!transcript.children) {
    return []
  }
  const exons: AnnotationFeatureSnapshot[] = []
  for (const [, child] of Object.entries(transcript.children)) {
    if (child.type === 'exon') {
      exons.push(child)
    }
  }
  if (exons.length < 2) {
    return []
  }
  exons.sort((a, b) => (a.min < b.min ? -1 : 1))

  const spliceSeq: SpliceSequence[] = []
  for (let i = 0; i < exons.length - 1; i++) {
    let fivePrimeMin = exons[i].max
    let threePrimeMin = exons[i + 1].min
    if (transcript.strand === -1) {
      ;[threePrimeMin, fivePrimeMin] = [fivePrimeMin, threePrimeMin]
      fivePrimeMin -= 2
    } else {
      threePrimeMin -= 2
    }

    let fivePrimeSeq = await getSequence(fivePrimeMin, fivePrimeMin + 2)
    let threePrimeSeq = await getSequence(threePrimeMin, threePrimeMin + 2)
    if (transcript.strand === -1) {
      threePrimeSeq = revcom(threePrimeSeq)
      fivePrimeSeq = revcom(fivePrimeSeq)
    }

    spliceSeq.push({ fivePrimeSeq, fivePrimeMin, threePrimeSeq, threePrimeMin })
  }
  return spliceSeq
}

async function checkTranscript(
  feature: AnnotationFeatureSnapshot,
  getSequence: (start: number, end: number) => Promise<string>,
): Promise<CheckResultSnapshot[]> {
  const checkResults: CheckResultSnapshot[] = []

  const VALID_FIVE_PRIME_SEQ = new Set(['GT'])
  const VALID_THREE_PRIME_SEQ = new Set(['AG'])
  const spliceSequences = await getSpliceSequences(feature, getSequence)
  for (const spliceSequence of spliceSequences) {
    if (!VALID_FIVE_PRIME_SEQ.has(spliceSequence.fivePrimeSeq.toUpperCase())) {
      checkResults.push({
        _id: new ObjectID().toHexString(),
        name: CHECK_NAME,
        cause: CAUSES[CAUSES.NonCanonicalSpliceSiteAtFivePrime],
        ids: [feature._id],
        refSeq: feature.refSeq.toString(),
        start: spliceSequence.fivePrimeMin,
        end: spliceSequence.fivePrimeMin + 2,
        message: `Unexpected 5' splice site in "${feature._id}". Expected: ${[...VALID_FIVE_PRIME_SEQ].join('|')}, got: ${spliceSequence.fivePrimeSeq}`,
      })
    }
    if (
      !VALID_THREE_PRIME_SEQ.has(spliceSequence.threePrimeSeq.toUpperCase())
    ) {
      checkResults.push({
        _id: new ObjectID().toHexString(),
        name: CHECK_NAME,
        cause: CAUSES[CAUSES.NonCanonicalSpliceSiteAtThreePrime],
        ids: [feature._id],
        refSeq: feature.refSeq.toString(),
        start: spliceSequence.threePrimeMin,
        end: spliceSequence.threePrimeMin + 2,
        message: `Unexpected 3' splice site in "${feature._id}". Expected: ${[...VALID_THREE_PRIME_SEQ].join('|')}, got: ${spliceSequence.threePrimeSeq}`,
      })
    }
  }
  return checkResults
}

function getCauses(): string[] {
  return Object.values(CAUSES).filter((x) =>
    Number.isNaN(Number(x)),
  ) as string[]
}
export class TranscriptCheck extends Check {
  name = 'TranscriptCheck'
  causes = getCauses()
  version = 1
  isDefault = true

  async checkFeature(
    feature: AnnotationFeatureSnapshot,
    getSequence: (start: number, end: number) => Promise<string>,
  ): Promise<CheckResultSnapshot[]> {
    if (
      feature.type === 'mRNA' ||
      feature.type === 'transcript' ||
      feature.type === 'pseudogenic_transcript'
    ) {
      return checkTranscript(feature, getSequence)
    }

    if (!feature.children) {
      return []
    }

    const checkResults: CheckResultSnapshot[] = []
    for (const child of Object.values(feature.children)) {
      checkResults.push(...(await this.checkFeature(child, getSequence)))
    }
    return checkResults
  }
}
