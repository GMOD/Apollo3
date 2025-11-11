import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

export function getPrintableId(feature: AnnotationFeatureSnapshot): string {
  const gff_id = feature.attributes?.gff_id?.join(', ')
  if (gff_id) {
    return `${gff_id} (_id: ${feature._id.toString()})`
  }
  const gff_name = feature.attributes?.gff_name?.join(', ')
  if (gff_name) {
    return `${gff_name} (_id: ${feature._id.toString()})`
  }
  return `_id: ${feature._id.toString()}`
}
