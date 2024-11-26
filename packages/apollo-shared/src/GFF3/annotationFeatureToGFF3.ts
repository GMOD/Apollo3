/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { GFF3Feature } from '@gmod/gff'

export function annotationFeatureToGFF3(
  feature: AnnotationFeatureSnapshot,
  parentId?: string,
  refSeqNames?: Record<string, string | undefined>,
): GFF3Feature {
  const locations = [{ start: feature.min, end: feature.max }]
  // const locations = feature.discontinuousLocations?.length
  //   ? feature.discontinuousLocations
  //   : [{ start: feature.start, end: feature.end, phase: feature.phase }]
  const attributes: Record<string, string[] | undefined> = JSON.parse(
    JSON.stringify(feature.attributes),
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
  let score = null
  if (gff_score) {
    if (gff_score.length == 1) {
      score = Number(gff_score[0])
    } else {
      throw new Error('Unexpected score')
    }
  }
  delete attributes.gff_score

  return locations.map((location) => ({
    start: location.start + 1,
    end: location.end,
    seq_id: refSeqNames ? refSeqNames[feature.refSeq] ?? null : feature.refSeq,
    source,
    type: feature.type,
    score,
    strand: feature.strand ? (feature.strand === 1 ? '+' : '-') : null,
    phase: null,
    // phase:
    //   location.phase === 0
    //     ? '0'
    //     : location.phase === 1
    //       ? '1'
    //       : location.phase === 2
    //         ? '2'
    //         : null,
    attributes: Object.keys(attributes).length > 0 ? attributes : null,
    derived_features: [],
    child_features: feature.children
      ? Object.values(feature.children).map((child) =>
          annotationFeatureToGFF3(child, attributes.ID?.[0], refSeqNames),
        )
      : [],
  }))
}
