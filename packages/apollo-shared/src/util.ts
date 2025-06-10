import { type AnnotationFeature } from '@apollo-annotation/mst'
import { type Feature } from '@apollo-annotation/schemas'

export function splitStringIntoChunks(
  input: string,
  chunkSize: number,
): string[] {
  const chunks: string[] = []
  for (let i = 0; i < input.length; i += chunkSize) {
    const chunk = input.slice(i, i + chunkSize)
    chunks.push(chunk)
  }
  return chunks
}

export function getPrintableId(feature: Feature): string {
  const ff = feature as unknown as AnnotationFeature
  const gff_id = ff.attributes.get('gff_id')?.join(',')
  if (gff_id) {
    return `ID=${gff_id} (_id: ${feature._id.toString()})`
  }
  const gff_name = ff.attributes.get('gff_name')?.join(',')
  if (gff_name) {
    return `Name=${gff_name} (_id: ${feature._id.toString()})`
  }
  return `_id: ${feature._id.toString()}`
}
