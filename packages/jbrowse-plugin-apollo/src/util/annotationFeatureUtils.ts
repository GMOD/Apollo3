import { type AnnotationFeature } from '@apollo-annotation/mst'

export function getFeatureName(feature: AnnotationFeature) {
  const { attributes } = feature
  const keys = [
    'name',
    'gff_name',
    'gene_name',
    'transcript_name',
    'exon_name',
    'protein_name',
  ]
  for (const key of keys) {
    const value = attributes.get(key)
    if (value?.[0]) {
      return value[0]
    }
  }
  return ''
}

export function getFeatureId(feature: AnnotationFeature) {
  const { attributes } = feature
  const keys = [
    'id',
    'gff_id',
    'gene_id',
    'stable_id',
    'gene_stable_id',
    'transcript_id',
    'exon_id',
    'protein_id',
  ]
  for (const key of keys) {
    const value = attributes.get(key)
    if (value?.[0]) {
      return value[0]
    }
  }
  return ''
}

export function getFeatureNameOrId(feature: AnnotationFeature) {
  const name = getFeatureName(feature)
  const id = getFeatureId(feature)
  if (name) {
    return `: ${name}`
  }
  if (id) {
    return `: ${id}`
  }
  return ''
}

export function getStrand(strand: number | undefined) {
  if (strand === 1) {
    return 'Forward'
  }
  if (strand === -1) {
    return 'Reverse'
  }
  return ''
}
