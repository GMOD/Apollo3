import { Check } from '@apollo-annotation/common'
import {
  type AnnotationFeatureSnapshot,
  type CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { intersection2 } from '@jbrowse/core/util'
import ObjectID from 'bson-objectid'

enum STOP_CODONS {
  'TAG',
  'TAA',
  'TGA',
}

enum START_CODONS {
  'ATG',
}

const CHECK_NAME = 'CDSCheck'

enum CAUSES {
  'InternalStopCodon',
  'MissingStartCodon',
  'MissingStopCodon',
}

const iupacComplements: Record<string, string | undefined> = {
  G: 'C',
  A: 'T',
  T: 'A',
  C: 'G',
  R /* G or A */: 'Y',
  Y /* T or C */: 'R',
  M /* A or C */: 'K',
  K /* G or T */: 'M',
  S /* G or C */: 'S',
  W /* A or T */: 'W',
  H /* A or C or T */: 'D',
  B /* G or T or C */: 'V',
  V /* G or C or A */: 'B',
  D /* G or A or T */: 'H',
  N /* G or A or T or C */: 'N',
}

type CDSLocation = { min: number; max: number; phase: 0 | 1 | 2 }[]
type CDSLocations = CDSLocation[]

function reverseComplement(dna: string): string {
  const complement: string[] = []
  for (const nt of dna) {
    const rc = iupacComplements[nt.toUpperCase()]
    if (rc === undefined) {
      throw new TypeError(`Cannot complement nucleotide: "${nt}"`)
    }
    if (nt === nt.toLowerCase()) {
      complement.push(rc.toLowerCase())
    } else {
      complement.push(rc)
    }
  }
  return complement.reverse().join('')
}

async function getCDSSequence(
  cdsLocation: CDSLocation,
  strand: 1 | -1 | undefined,
  getSequence: (start: number, end: number) => Promise<string>,
): Promise<string> {
  const sequences = await Promise.all(
    cdsLocation.map(({ max, min }) => getSequence(min, max)),
  )
  let seq = sequences.join('')
  if (strand === -1) {
    seq = reverseComplement(seq)
  }
  return seq
}

function splitSequenceInCodons(cds: string): string[] {
  const codons: string[] = []
  for (let i = 0; i <= cds.length - 3; i += 3) {
    codons.push(cds.slice(i, i + 3))
  }
  return codons
}

function cmp(pos: number, max: number, strand: -1 | 1 | undefined): boolean {
  if (strand === -1) {
    return pos > max
  }
  return pos < max
}

function getOriginalCodonLocation(
  cdsLocation: CDSLocation,
  strand: 1 | -1 | undefined,
  index: number,
): [number, number] | undefined {
  // Index 0 is the start codon, so reverse the CDS locations if strand is -1
  const sortedLocation: CDSLocation = structuredClone(cdsLocation)
  if (strand === -1) {
    sortedLocation.sort((a, b) => (a.min < b.min ? 1 : -1))
  } else {
    sortedLocation.sort((a, b) => (a.min < b.min ? -1 : 1))
  }
  let i = 0
  let currentStart: number | undefined = undefined
  let currentEnd: number | undefined = undefined
  for (let iloc = 0; iloc < sortedLocation.length; iloc++) {
    const loc = sortedLocation[iloc]
    const { phase } = loc
    // On the reverse strand start iterating from the right and end on the left
    const startAt = strand === -1 ? loc.max - phase : loc.min + phase
    const endAt = strand === -1 ? loc.min : loc.max
    for (
      let pos = startAt;
      cmp(pos, endAt, strand);
      pos = strand === -1 ? pos - 3 : pos + 3
    ) {
      currentStart = pos
      currentEnd = strand === -1 ? currentStart - 3 : currentStart + 3
      // These if conditions occur if a codon is split between two exons
      if (strand === -1 && currentEnd < loc.min) {
        currentEnd =
          sortedLocation[iloc + 1].max - sortedLocation[iloc + 1].phase
      } else if (currentEnd > loc.max) {
        currentEnd =
          sortedLocation[iloc + 1].min + sortedLocation[iloc + 1].phase
      }
      if (i === index) {
        return [currentStart, currentEnd].sort((a, b) => a - b) as [
          number,
          number,
        ]
      }
      i++
    }
  }
  return undefined
}

async function checkMRNA(
  feature: AnnotationFeatureSnapshot,
  getSequence: (start: number, end: number) => Promise<string>,
): Promise<CheckResultSnapshot[]> {
  const checkResults: CheckResultSnapshot[] = []
  const { _id, max, min, refSeq, strand } = feature

  const cdsLocations = getCDSLocations(feature)

  if (!cdsLocations) {
    return checkResults
  }
  const ids = [_id]
  for (const cdsLocation of cdsLocations) {
    const sequence = await getCDSSequence(cdsLocation, strand, getSequence)
    const codons = splitSequenceInCodons(sequence)
    const cdsEnd =
      strand === -1
        ? cdsLocation.at(0)?.min ?? min
        : cdsLocation.at(-1)?.max ?? max
    if (sequence.length % 3 === 0) {
      const start_codon = codons.at(0)
      if (start_codon && !(start_codon.toUpperCase() in START_CODONS)) {
        let cdsStart =
          strand === -1
            ? cdsLocation.at(-1)?.max ?? max
            : cdsLocation.at(0)?.min ?? min
        cdsStart = strand === -1 ? cdsStart - 3 : cdsStart
        checkResults.push({
          _id: new ObjectID().toHexString(),
          name: CHECK_NAME,
          cause: CAUSES[CAUSES.MissingStartCodon],
          ids,
          refSeq: refSeq.toString(),
          start: cdsStart,
          end: cdsStart,
          message: `Unexpected start codon in feature "${_id}": ${start_codon}`,
        })
      }

      const lastCodon = codons.at(-1) // Last codon is supposed to be a stop
      if (lastCodon && !(lastCodon.toUpperCase() in STOP_CODONS)) {
        checkResults.push({
          _id: new ObjectID().toHexString(),
          name: CHECK_NAME,
          cause: CAUSES[CAUSES.MissingStopCodon],
          ids,
          refSeq: refSeq.toString(),
          start: cdsEnd,
          end: cdsEnd,
          message: `Missing stop codon in feature "${_id}"`,
        })
      }
    } else {
      checkResults.push({
        _id: new ObjectID().toHexString(),
        name: CHECK_NAME,
        cause: CAUSES[CAUSES.MissingStopCodon],
        ids,
        refSeq: refSeq.toString(),
        start: cdsEnd,
        end: cdsEnd,
        message: `Missing stop codon in feature "${_id}"`,
      })
    }
    for (const [idx, codon] of codons.entries()) {
      if (idx === codons.length - 1) {
        // Don't test last codon as it is supposed to be a stop
        break
      }
      const location = getOriginalCodonLocation(cdsLocation, strand, idx)
      if (location && codon.toUpperCase() in STOP_CODONS) {
        const [codonStart, codonEnd] = location
        checkResults.push({
          _id: new ObjectID().toHexString(),
          name: CHECK_NAME,
          cause: CAUSES[CAUSES.InternalStopCodon],
          ids,
          refSeq: refSeq.toString(),
          start: codonStart,
          end: codonEnd,
          message: `Internal stop codon in feature "${_id}"`,
        })
      }
    }
  }
  return checkResults
}

function getCDSLocations(
  feature: AnnotationFeatureSnapshot,
): CDSLocations | undefined {
  if (feature.type !== 'mRNA') {
    return
  }
  const { children, strand } = feature
  if (!children) {
    return
  }
  const cdsChildren = Object.values(children).filter(
    (child) => child.type === 'CDS',
  )
  if (cdsChildren.length === 0) {
    return
  }
  const cdsLocations: CDSLocations = []
  for (const cds of cdsChildren) {
    const { max: cdsMax, min: cdsMin } = cds
    const locs: { min: number; max: number }[] = []
    for (const child of Object.values(children)) {
      if (child.type !== 'exon') {
        continue
      }
      const [start, end] = intersection2(cdsMin, cdsMax, child.min, child.max)
      if (start !== undefined && end !== undefined) {
        locs.push({ min: start, max: end })
      }
    }
    locs.sort(({ min: a }, { min: b }) => a - b)
    if (strand === -1) {
      locs.reverse()
    }
    let nextPhase: 0 | 1 | 2 = 0
    const phasedLocs = locs.map((loc) => {
      const phase = nextPhase
      nextPhase = ((3 - ((loc.max - loc.min - phase + 3) % 3)) % 3) as 0 | 1 | 2
      return { ...loc, phase }
    })
    phasedLocs.sort((a, b) => (a.min < b.min ? -1 : 1))
    cdsLocations.push(phasedLocs)
  }
  if (cdsLocations.length > 1) {
    cdsLocations.sort((a, b) => (a[0].min < b[0].min ? -1 : 1))
  }
  return cdsLocations
}

function getCauses(): string[] {
  return Object.values(CAUSES).filter((x) =>
    Number.isNaN(Number(x)),
  ) as string[]
}
export class CDSCheck extends Check {
  name = CHECK_NAME
  causes = getCauses()
  version = 1
  isDefault = true

  async checkFeature(
    feature: AnnotationFeatureSnapshot,
    getSequence: (start: number, end: number) => Promise<string>,
  ): Promise<CheckResultSnapshot[]> {
    if (feature.type === 'mRNA') {
      return checkMRNA(feature, getSequence)
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
