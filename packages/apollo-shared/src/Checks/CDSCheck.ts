import { Check } from '@apollo-annotation/common'
import {
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { intersection2 } from '@jbrowse/core/util'
import ObjectID from 'bson-objectid'

enum STOP_CODONS {
  'TAG',
  'TAA',
  'TGA',
}

const CHECK_NAME = 'CDSCheck'

enum CAUSES {
  'MissingStopCodon',
  'MultipleOfThree',
  'InternalStopCodon',
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
  if (strand === -1) {
    return sequences.map((seq) => reverseComplement(seq)).join('')
  }
  return sequences.join('')
}

function splitSequenceInCodons(cds: string): string[] {
  const codons: string[] = []
  for (let i = 0; i <= cds.length - 3; i += 3) {
    codons.push(cds.slice(i, i + 3))
  }
  return codons
}

function getOriginalCodonLocation(
  cdsLocation: CDSLocation,
  strand: 1 | -1 | undefined,
  index: number,
): [number, number] | undefined {
  let lengthToStart = index * 3
  let lengthToEnd = lengthToStart + 3

  let startLocation: number | undefined = undefined,
    endLocation: number | undefined = undefined
  for (const loc of cdsLocation) {
    const locLength = loc.max - loc.min
    if (startLocation === undefined && locLength > lengthToStart) {
      startLocation = loc.min + lengthToStart
    } else {
      lengthToStart -= locLength
    }
    if (endLocation === undefined && locLength > lengthToEnd) {
      endLocation = loc.min + lengthToEnd
    } else {
      lengthToEnd -= locLength
    }
    if (startLocation !== undefined && endLocation !== undefined) {
      return [startLocation, endLocation]
    }
  }
  return
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
    if (sequence.length % 3 === 0) {
      const lastCodon = codons.pop() // Last codon is supposed to be a stop
      if (lastCodon && !(lastCodon.toUpperCase() in STOP_CODONS)) {
        checkResults.push({
          _id: new ObjectID().toHexString(),
          name: CHECK_NAME,
          cause: CAUSES[CAUSES.MissingStopCodon],
          ids,
          refSeq: refSeq.toString(),
          start: max,
          end: max,
          message: `Missing stop codon`,
        })
      }
    } else {
      checkResults.push({
        _id: new ObjectID().toHexString(),
        name: CHECK_NAME,
        cause: CAUSES[CAUSES.MultipleOfThree],
        ids,
        refSeq: refSeq.toString(),
        start: min,
        end: max,
        message: `The coding sequence for feature "${_id}" is not a multiple of three`,
      })
    }
    for (const [idx, codon] of codons.entries()) {
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
          message: `The coding sequence for feature "${_id}" has an internal stop codon`,
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
    cdsLocations.push(phasedLocs)
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
  default = true

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
