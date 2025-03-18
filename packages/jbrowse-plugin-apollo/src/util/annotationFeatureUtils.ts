import { AnnotationFeature } from '@apollo-annotation/mst'

export function getFeatureName(feature: AnnotationFeature) {
  const { attributes } = feature
  const name = attributes.get('gff_name')
  if (name) {
    return name[0]
  }
  return ''
}

export function getFeatureId(feature: AnnotationFeature) {
  const { attributes } = feature
  const id = attributes.get('gff_id')
  const transcript_id = attributes.get('transcript_id')
  const exon_id = attributes.get('exon_id')
  const protein_id = attributes.get('protein_id')
  if (id) {
    return id[0]
  }
  if (transcript_id) {
    return transcript_id[0]
  }
  if (exon_id) {
    return exon_id[0]
  }
  if (protein_id) {
    return protein_id[0]
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
