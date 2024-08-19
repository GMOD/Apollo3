import { Check } from '@apollo-annotation/common'
import {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
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
  strand: 1 | -1 | undefined
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
  parent: AnnotationFeature,
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

export class CDSCheck extends Check {
  name = 'CDSCheck'
  version = 1
  default = true

  async checkFeature(
    _featureSnapshot: AnnotationFeatureSnapshot,
    getSequence: (start: number, end: number) => Promise<string>,
    feature?: AnnotationFeature,
  ): Promise<CheckResultSnapshot[]> {
    if (!feature) {
      return []
    }

    const mRNAs: AnnotationFeature[] = []
    if (feature.type === 'gene' && feature.children) {
      for (const [, child] of feature.children) {
        if (child.type === 'mRNA') {
          mRNAs.push(child)
        }
      }
    }

    if (feature.type === 'mRNA') {
      mRNAs.push(feature)
    }

    const checkResults: CheckResultSnapshot[] = []
    for (const mRNA of mRNAs) {
      const { _id, cdsLocations } = mRNA

      if (cdsLocations.length === 0) {
        throw new Error(`mRNA "${_id}" has no CDS children`)
      }
      for (const cds of cdsLocations) {
        let cdsSequence = ''
        const cdsIds: string[] = []
        const codons: string[] = []
        const cdsMin = cds.at(0)?.min
        const cdsMax = cds.at(-1)?.max
        const firstLocStrand = cds.at(0)?.strand
        let isValidStrand = true

        if (
          cdsMin === undefined ||
          cdsMax === undefined ||
          firstLocStrand === undefined
        ) {
          // move to next CDS
          continue
        }

        for (const loc of cds) {
          if (loc.strand !== firstLocStrand) {
            isValidStrand = false
            break
          }
          cdsSequence = cdsSequence + (await getSequence(loc.min, loc.max))
          cdsIds.push(loc._id)
        }

        if (!isValidStrand) {
          continue
        }

        if (firstLocStrand === -1) {
          cdsSequence = reverseComplement(cdsSequence)
        }

        for (let i = 0; i <= cdsSequence.length - 3; i += 3) {
          codons.push(cdsSequence.slice(i, i + 3))
        }

        checkResults.push(
          ...checkCDS(
            feature,
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
