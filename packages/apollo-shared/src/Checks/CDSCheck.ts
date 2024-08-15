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

interface CodonObj {
  value: string
  start: number
  end: number
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
  codonObj: CodonObj[],
): CheckResultSnapshot[] {
  const checkResults: CheckResultSnapshot[] = []
  const { _id, refSeq } = parent

  if (cdsSequence.length % 3 === 0) {
    const lastCodon = codonObj.pop() // Last codon is supposed to be a stop
    if (!lastCodon) {
      throw new Error(`No sequence found for feature "${_id}"`)
    }
    if (!(lastCodon.value.toUpperCase() in STOP_CODONS)) {
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
  for (const [, codon] of codonObj.entries()) {
    if (codon.value.toUpperCase() in STOP_CODONS) {
      checkResults.push({
        _id: new ObjectID().toHexString(),
        name: 'InternalStopCodonCheck',
        ids: cdsIds,
        refSeq: refSeq.toString(),
        start: codon.start,
        end: codon.end,
        message: `The coding sequence for feature "${_id}" has an internal stop codon`,
      })
    }
  }
  return checkResults
}

export class CDSCheck extends Check {
  name = 'CDSCheck'
  version = 1
  default = true

  async checkFeature(
    featureSnapshot: AnnotationFeatureSnapshot,
    getSequence: (start: number, end: number) => Promise<string>,
    feature?: AnnotationFeature,
  ): Promise<CheckResultSnapshot[]> {
    if (!feature || feature.type !== 'mRNA') {
      return []
    }

    const { _id, cdsLocations } = feature

    if (cdsLocations.length === 0) {
      throw new Error(`mRNA "${_id}" has no CDS children`)
    }
    const checkResults: CheckResultSnapshot[] = []
    for (const cds of cdsLocations) {
      let cdsSequence = ''
      const cdsIds: string[] = []
      const codonObj: CodonObj[] = []
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
        codonObj.push({
          start: cdsMin + i,
          end: cdsMin + i + 3,
          value: cdsSequence.slice(i, i + 3),
        })
      }

      checkResults.push(
        ...checkCDS(
          featureSnapshot,
          cdsSequence,
          cdsMin,
          cdsMax,
          cdsIds,
          codonObj,
        ),
      )
    }
    return checkResults
  }
}
