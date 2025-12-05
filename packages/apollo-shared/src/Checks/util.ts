import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

export function getPrintableId(feature: AnnotationFeatureSnapshot): string {
  const { featureId } = feature
  if (featureId) {
    return `${featureId} (_id: ${feature._id.toString()})`
  }
  const gff_name = feature.attributes?.gff_name?.join(', ')
  if (gff_name) {
    return `${gff_name} (_id: ${feature._id.toString()})`
  }
  return `_id: ${feature._id.toString()}`
}
