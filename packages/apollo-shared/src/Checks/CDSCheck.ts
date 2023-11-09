import { Check } from 'apollo-common'
import { AnnotationFeatureSnapshot, CheckResultSnapshot } from 'apollo-mst'
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

async function getSequenceFromSingleFeature(
  feature: AnnotationFeatureSnapshot,
  getSequence: (start: number, end: number) => Promise<string>,
) {
  let seq = ''
  if (
    feature.discontinuousLocations !== undefined &&
    feature.discontinuousLocations.length > 0
  ) {
    for (const loc of feature.discontinuousLocations) {
      seq = seq + (await getSequence(loc.start, loc.end))
    }
  } else {
    seq = await getSequence(feature.start, feature.end)
  }
  if (feature.strand === -1) {
    return reverseComplement(seq)
  }
  return seq
}

async function getSequenceFromMultipleFeatures(
  features: AnnotationFeatureSnapshot[],
  getSequence: (start: number, end: number) => Promise<string>,
) {
  const strands = features.map((feature) => feature.strand)
  if (!strands.every((strand) => strand === strands[0])) {
    throw new Error(
      `Strands do not match in features: "${features
        .map((f) => f._id)
        .join(', ')}"`,
    )
  }
  let seq = ''
  for (const feature of features) {
    seq = seq + (await getSequence(feature.start, feature.end))
  }
  if (strands[0] === -1) {
    return reverseComplement(seq)
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

function getOriginalCodonLocation(
  feature: AnnotationFeatureSnapshot | AnnotationFeatureSnapshot[],
  index: number,
): [number, number] {
  let lengthToStart = index * 3
  let lengthToEnd = lengthToStart + 3
  if (Array.isArray(feature)) {
    let startLocation: number | undefined = undefined,
      endLocation: number | undefined = undefined
    for (const f of feature) {
      const featureLength = f.end - f.start
      if (startLocation === undefined && featureLength > lengthToStart) {
        startLocation = f.start + lengthToStart
      } else {
        lengthToStart -= featureLength
      }
      if (endLocation === undefined && featureLength > lengthToEnd) {
        endLocation = f.start + lengthToEnd
      } else {
        lengthToEnd -= featureLength
      }
      if (startLocation !== undefined && endLocation !== undefined) {
        return [startLocation, endLocation]
      }
    }
    throw new Error('Could not determine original CDS location')
  } else {
    if (
      feature.discontinuousLocations !== undefined &&
      feature.discontinuousLocations.length > 0
    ) {
      let startLocation: number | undefined = undefined,
        endLocation: number | undefined = undefined
      for (const loc of feature.discontinuousLocations) {
        const locLength = loc.end - loc.start
        if (startLocation === undefined && locLength > lengthToStart) {
          startLocation = loc.start + lengthToStart
        } else {
          lengthToStart -= locLength
        }
        if (endLocation === undefined && locLength > lengthToEnd) {
          endLocation = loc.start + lengthToEnd
        } else {
          lengthToEnd -= locLength
        }
        if (startLocation !== undefined && endLocation !== undefined) {
          return [startLocation, endLocation]
        }
      }
      throw new Error('Could not determine original CDS location')
    } else {
      return [feature.start + lengthToStart, feature.start + lengthToEnd]
    }
  }
}

async function checkCDS(
  feature: AnnotationFeatureSnapshot | AnnotationFeatureSnapshot[],
  getSequence: (start: number, end: number) => Promise<string>,
): Promise<CheckResultSnapshot[]> {
  const checkResults: CheckResultSnapshot[] = []
  let _id: string,
    ids: string[],
    start: number,
    end: number,
    refSeq: string,
    sequence: string
  if (Array.isArray(feature)) {
    sequence = await getSequenceFromMultipleFeatures(feature, getSequence)
    ids = feature.map((f) => f._id)
    _id = ids.join(',')
    ;[{ refSeq, start }] = feature
    const lastFeature = feature.at(-1)
    if (!lastFeature) {
      throw new Error('Zero-length feature array encountered')
    }
    ;({ end } = lastFeature)
  } else {
    sequence = await getSequenceFromSingleFeature(feature, getSequence)
    ;({ _id, end, refSeq, start } = feature)
    ids = [_id]
  }
  const codons = splitSequenceInCodons(sequence)
  if (sequence.length % 3 === 0) {
    const lastCodon = codons.pop() // Last codon is supposed to be a stop
    if (!lastCodon) {
      throw new Error(`No sequence found for feature "${_id}"`)
    }
    if (!(lastCodon.toUpperCase() in STOP_CODONS)) {
      checkResults.push({
        _id: new ObjectID().toHexString(),
        name: 'MissingStopCodonCheck',
        ids,
        refSeq: refSeq.toString(),
        start: end - 3,
        end,
        message: `Feature "${_id}" is missing a stop codon`,
      })
    }
  } else {
    checkResults.push({
      _id: new ObjectID().toHexString(),
      name: 'MultipleOfThreeCheck',
      ids,
      refSeq: refSeq.toString(),
      start,
      end,
      message: `The coding sequence for feature "${_id}" is not a multiple of three`,
    })
  }
  for (const [idx, codon] of codons.entries()) {
    const [codonStart, codonEnd] = getOriginalCodonLocation(feature, idx)
    if (codon.toUpperCase() in STOP_CODONS) {
      checkResults.push({
        _id: new ObjectID().toHexString(),
        name: 'InternalStopCodonCheck',
        ids,
        refSeq: refSeq.toString(),
        start: codonStart,
        end: codonEnd,
        message: `The coding sequence for feature "${_id}" is not a multiple of three`,
      })
    }
  }
  return checkResults
}

export class CDSCheck extends Check {
  async checkFeature(
    feature: AnnotationFeatureSnapshot,
    getSequence: (start: number, end: number) => Promise<string>,
  ): Promise<CheckResultSnapshot[]> {
    if (feature.type === 'CDS') {
      return checkCDS(feature, getSequence)
    }

    if (!feature.children) {
      return []
    }

    if (feature.type !== 'mRNA') {
      const checkResults: CheckResultSnapshot[] = []
      for (const child of Object.values(feature.children)) {
        checkResults.push(...(await this.checkFeature(child, getSequence)))
      }
      return checkResults
    }

    const cdsChildren = Object.values(feature.children).filter(
      (child) => child.type === 'CDS',
    )
    if (cdsChildren.length === 0) {
      throw new Error(`mRNA "${feature._id}" has no CDS children`)
    }
    const cdsChildrenWithDiscontinuousLocations = cdsChildren.filter(
      (child) =>
        child.discontinuousLocations && child.discontinuousLocations.length > 0,
    )
    if (cdsChildrenWithDiscontinuousLocations.length === 0) {
      return checkCDS(cdsChildren, getSequence)
    }
    if (cdsChildrenWithDiscontinuousLocations.length === cdsChildren.length) {
      const checkResults: CheckResultSnapshot[] = []
      for (const child of cdsChildren) {
        checkResults.push(...(await this.checkFeature(child, getSequence)))
      }
      return checkResults
    }
    throw new Error(
      `Mix of CDS with and without discontinuous locations found in mRNA "${feature._id}"`,
    )
  }
}
