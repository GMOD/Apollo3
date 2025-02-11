/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  AnnotationFeatureSnapshot,
  TranscriptPartLocation,
  TranscriptPartNonCoding,
} from '@apollo-annotation/mst'
import { GFF3Feature } from '@gmod/gff'
import { intersection2 } from '@jbrowse/core/util'

export function annotationFeatureToGFF3(
  feature: AnnotationFeatureSnapshot,
  parentId?: string,
  refSeqNames?: Record<string, string | undefined>,
): GFF3Feature {
  const attributes: Record<string, string[] | undefined> = JSON.parse(
    JSON.stringify(feature.attributes ?? {}),
  )
  const ontologyTerms: string[] = []
  const source = feature.attributes?.gff_source?.[0] ?? null

  delete attributes.gff_source
  if (parentId) {
    attributes.Parent = [parentId]
  }
  if (attributes.gff_id) {
    attributes.ID = attributes.gff_id
    delete attributes.gff_id
  } else if (feature.children) {
    attributes.ID = [feature._id]
  }
  if (attributes.gff_name) {
    attributes.Name = attributes.gff_name
    delete attributes.gff_name
  }
  if (attributes.gff_alias) {
    attributes.Alias = attributes.gff_alias
    delete attributes.gff_alias
  }
  if (attributes.gff_target) {
    attributes.Target = attributes.gff_target
    delete attributes.gff_target
  }
  if (attributes.gff_gap) {
    attributes.Gap = attributes.gff_gap
    delete attributes.gff_gap
  }
  if (attributes.gff_derives_from) {
    attributes.Derives_from = attributes.gff_derives_from
    delete attributes.gff_derives_from
  }
  if (attributes.gff_note) {
    attributes.Note = attributes.gff_note
    delete attributes.gff_note
  }
  if (attributes.gff_dbxref) {
    attributes.Dbxref = attributes.gff_dbxref
    delete attributes.gff_dbxref
  }
  if (attributes.gff_is_circular) {
    attributes.Is_circular = attributes.gff_is_circular
    delete attributes.gff_is_circular
  }
  if (attributes.gff_ontology_term) {
    ontologyTerms.push(...attributes.gff_ontology_term)
    delete attributes.gff_ontology_term
  }
  if (attributes['Gene Ontology']) {
    ontologyTerms.push(...attributes['Gene Ontology'])
    delete attributes['Gene Ontology']
  }
  if (attributes['Sequence Ontology']) {
    ontologyTerms.push(...attributes['Sequence Ontology'])
    delete attributes['Sequence Ontology']
  }
  if (ontologyTerms.length > 0) {
    attributes.Ontology_term = ontologyTerms
  }

  const gff_score = feature.attributes?.gff_score
  let score: number | null = null
  if (gff_score && gff_score.length > 0) {
    if (gff_score[0]) {
      score = Number(gff_score[0])
      if (Number.isNaN(score)) {
        score = null
      }
    }
    delete attributes.gff_score
  }

  const locations = [{ start: feature.min, end: feature.max }]

  return locations.map((location) => ({
    start: Number(location.start) + 1,
    end: Number(location.end),
    seq_id: refSeqNames ? refSeqNames[feature.refSeq] ?? null : feature.refSeq,
    source,
    type: feature.type,
    score,
    strand: feature.strand ? (feature.strand === 1 ? '+' : '-') : null,
    phase: null,
    attributes: Object.keys(attributes).length > 0 ? attributes : null,
    derived_features: [],
    child_features: prepareChildFeatures(
      feature,
      attributes.ID?.[0],
      refSeqNames,
    ),
  }))
}

function prepareChildFeatures(
  feature: AnnotationFeatureSnapshot,
  parentID?: string,
  refSeqNames?: Record<string, string | undefined>,
): GFF3Feature[] {
  if (!feature.children) {
    return []
  }
  if (feature.type === 'mRNA') {
    const child_features: GFF3Feature[] = []
    const cdsLocations = getCdsLocations(feature)
    let cds_idx = 0
    for (const child of Object.values(feature.children)) {
      const gffChild = annotationFeatureToGFF3(child, parentID, refSeqNames)
      if (child.type === 'CDS') {
        for (const loc of cdsLocations[cds_idx]) {
          const gffCds = JSON.parse(JSON.stringify(gffChild)) as GFF3Feature
          if (gffCds.length != 1) {
            // Do we need this check?
            throw new Error(
              `Unexpected CDS: ${JSON.stringify(gffCds, null, 2)}`,
            )
          }
          gffCds[0].start = loc.min + 1
          gffCds[0].end = loc.max
          gffCds[0].phase = loc.phase.toString()
          gffCds[0].type = loc.type // Do we need this?
          child_features.push(gffCds)
        }
        cds_idx++
      } else {
        child_features.push(gffChild)
      }
    }
    return child_features
  }
  return Object.values(feature.children).map((child) =>
    annotationFeatureToGFF3(child, parentID, refSeqNames),
  )
}

interface TranscriptPartCoding extends TranscriptPartLocation {
  type: 'CDS'
  phase: 0 | 1 | 2
}
type TranscriptPart = TranscriptPartCoding | TranscriptPartNonCoding
type TranscriptParts = TranscriptPart[]

function getTranscriptParts(
  feature: AnnotationFeatureSnapshot,
): TranscriptParts[] {
  if (feature.type !== 'mRNA') {
    throw new Error(
      'Only features of type "mRNA" or equivalent can calculate CDS locations',
    )
  }
  if (!feature.children) {
    throw new Error('no CDS or exons in mRNA')
  }
  // In AnnotationFeatureModel we have `children.values()`
  const children = Object.values(feature.children)
  const cdsChildren = children.filter((child) => child.type === 'CDS')
  if (cdsChildren.length === 0) {
    throw new Error('no CDS in mRNA')
  }
  const transcriptParts: TranscriptParts[] = []
  for (const cds of cdsChildren) {
    const { max: cdsMax, min: cdsMin } = cds
    const parts: TranscriptParts = []
    let hasIntersected = false
    const exonLocations: TranscriptPartLocation[] = []
    for (const child of children) {
      if (child.type === 'exon') {
        exonLocations.push({ min: child.min, max: child.max })
      }
    }
    exonLocations.sort(({ min: a }, { min: b }) => a - b)
    for (const child of exonLocations) {
      const lastPart = parts.at(-1)
      if (lastPart) {
        parts.push({ min: lastPart.max, max: child.min, type: 'intron' })
      }
      const [start, end] = intersection2(cdsMin, cdsMax, child.min, child.max)
      let utrType: 'fivePrimeUTR' | 'threePrimeUTR'
      if (hasIntersected) {
        utrType = feature.strand === 1 ? 'threePrimeUTR' : 'fivePrimeUTR'
      } else {
        utrType = feature.strand === 1 ? 'fivePrimeUTR' : 'threePrimeUTR'
      }
      if (start !== undefined && end !== undefined) {
        hasIntersected = true
        if (start === child.min && end === child.max) {
          parts.push({ min: start, max: end, phase: 0, type: 'CDS' })
        } else if (start === child.min) {
          parts.push(
            { min: start, max: end, phase: 0, type: 'CDS' },
            { min: end, max: child.max, type: utrType },
          )
        } else if (end === child.max) {
          parts.push(
            { min: child.min, max: start, type: utrType },
            { min: start, max: end, phase: 0, type: 'CDS' },
          )
        } else {
          parts.push(
            { min: child.min, max: start, type: utrType },
            { min: start, max: end, phase: 0, type: 'CDS' },
            {
              min: end,
              max: child.max,
              type:
                utrType === 'fivePrimeUTR' ? 'threePrimeUTR' : 'fivePrimeUTR',
            },
          )
        }
      } else {
        parts.push({ min: child.min, max: child.max, type: utrType })
      }
    }
    parts.sort(({ min: a }, { min: b }) => a - b)
    if (feature.strand === -1) {
      parts.reverse()
    }
    let nextPhase: 0 | 1 | 2 = 0
    const phasedParts = parts.map((loc) => {
      if (loc.type !== 'CDS') {
        return loc
      }
      const phase = nextPhase
      nextPhase = ((3 - ((loc.max - loc.min - phase + 3) % 3)) % 3) as 0 | 1 | 2
      return { ...loc, phase }
    })
    transcriptParts.push(phasedParts)
  }
  return transcriptParts
}

function getCdsLocations(
  feature: AnnotationFeatureSnapshot,
): TranscriptPartCoding[][] {
  const transcriptParts = getTranscriptParts(feature)
  return transcriptParts.map((transcript) =>
    transcript.filter((transcriptPart) => transcriptPart.type === 'CDS'),
  )
}
