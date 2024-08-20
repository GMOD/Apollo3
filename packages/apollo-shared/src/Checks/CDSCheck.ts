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

interface CDSLocation {
  _id: string
  min: number
  max: number
  phase: 0 | 1 | 2
}

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

function checkCDS(
  parent: AnnotationFeatureSnapshot,
  cdsSequence: string,
  cdsMin: number,
  cdsMax: number,
  cdsIds: string[],
  codons: string[],
  cdsLocations: CDSLocation[],
): CheckResultSnapshot[] {
  const checkResults: CheckResultSnapshot[] = []
  const { _id, refSeq } = parent

  if (cdsSequence.length % 3 === 0) {
    const lastCodon = codons.pop() // Last codon is supposed to be a stop
    if (!lastCodon) {
      throw new Error(`No sequence found for feature "${_id}"`)
    }
    if (!(lastCodon.toUpperCase() in STOP_CODONS)) {
      checkResults.push({
        _id: new ObjectID().toHexString(),
        name: 'MissingStopCodonCheck',
        ids: cdsIds,
        refSeq: refSeq.toString(),
        start: cdsMax,
        end: cdsMax,
        message: `Feature "${_id}" is missing a stop codon`,
      })
    }
  } else {
    checkResults.push({
      _id: new ObjectID().toHexString(),
      name: 'MultipleOfThreeCheck',
      ids: cdsIds,
      refSeq: refSeq.toString(),
      start: cdsMin,
      end: cdsMax,
      message: `The coding sequence for feature "${_id}" is not a multiple of three`,
    })
  }
  for (const [i, codon] of codons.entries()) {
    const [codonStart, codonEnd] = getOriginalCodonLocation(cdsLocations, i)
    if (codon.toUpperCase() in STOP_CODONS) {
      checkResults.push({
        _id: new ObjectID().toHexString(),
        name: 'InternalStopCodonCheck',
        ids: cdsIds,
        refSeq: refSeq.toString(),
        start: codonStart,
        end: codonEnd,
        message: `The coding sequence for feature "${_id}" has an internal stop codon`,
      })
    }
  }
  return checkResults
}

function getOriginalCodonLocation(
  cdsLocations: CDSLocation[],
  index: number,
): [number, number] {
  let lengthToStart = index * 3
  let lengthToEnd = lengthToStart + 3
  let startLocation: number | undefined = undefined,
    endLocation: number | undefined = undefined
  for (const loc of cdsLocations) {
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
  throw new Error(`Could not find original codon location for index ${index}`)
}

function getCdsLocations(mRNA: AnnotationFeatureSnapshot): CDSLocation[][] {
  const { children, strand } = mRNA
  if (!children) {
    return []
  }
  const cdsChildren = Object.values(children).filter(
    (child) => child.type === 'CDS',
  )
  if (cdsChildren.length === 0) {
    return []
  }
  const cdsLocations: CDSLocation[][] = []
  for (const cds of cdsChildren) {
    const { _id, max: cdsMax, min: cdsMin } = cds
    const locs: {
      min: number
      max: number
    }[] = []
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
      return { ...loc, phase, _id }
    })
    cdsLocations.push(phasedLocs)
  }
  return cdsLocations
}

export class CDSCheck extends Check {
  name = 'CDSCheck'
  version = 1
  default = true

  async checkFeature(
    featureSnapshot: AnnotationFeatureSnapshot,
    getSequence: (start: number, end: number) => Promise<string>,
  ): Promise<CheckResultSnapshot[]> {
    const mRNAs: AnnotationFeatureSnapshot[] = []
    if (featureSnapshot.type === 'gene' && featureSnapshot.children) {
      for (const child of Object.values(featureSnapshot.children)) {
        if (child.type === 'mRNA') {
          mRNAs.push(child)
        }
      }
    }

    if (featureSnapshot.type === 'mRNA') {
      mRNAs.push(featureSnapshot)
    }

    const checkResults: CheckResultSnapshot[] = []
    for (const mRNA of mRNAs) {
      const cdsLocations = getCdsLocations(mRNA)

      if (cdsLocations.length === 0) {
        // move to next mRNA
        continue
      }
      for (const cds of cdsLocations) {
        let cdsSequence = ''
        const cdsIds: string[] = []
        const codons: string[] = []
        const cdsMin = cds.at(0)?.min
        const cdsMax = cds.at(-1)?.max

        if (cdsMin === undefined || cdsMax === undefined) {
          // move to next CDS
          continue
        }

        for (const loc of cds) {
          cdsSequence = cdsSequence + (await getSequence(loc.min, loc.max))
          cdsIds.push(loc._id)
        }

        if (featureSnapshot.strand === -1) {
          cdsSequence = reverseComplement(cdsSequence)
        }

        for (let i = 0; i <= cdsSequence.length - 3; i += 3) {
          codons.push(cdsSequence.slice(i, i + 3))
        }

        checkResults.push(
          ...checkCDS(
            featureSnapshot,
            cdsSequence,
            cdsMin,
            cdsMax,
            cdsIds,
            codons,
            cds,
          ),
        )
      }
    }
    return checkResults
  }
}
