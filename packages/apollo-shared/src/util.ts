import { type AnnotationFeature } from '@apollo-annotation/mst'
import { type Feature } from '@apollo-annotation/schemas'
import { type IKeyValueMap } from 'mobx'

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
  const { featureId } = feature
  if (featureId) {
    return `ID=${featureId} (_id: ${feature._id.toString()})`
  }
  const gff_name = ff.attributes.get('gff_name')?.join(',')
  if (gff_name) {
    return `Name=${gff_name} (_id: ${feature._id.toString()})`
  }
  return `_id: ${feature._id.toString()}`
}

export function attributesToRecords(
  attributes: IKeyValueMap<readonly string[] | undefined> | undefined,
): Record<string, string[] | undefined> {
  const records: Record<string, string[] | undefined> = {}
  if (!attributes) {
    return records
  }
  for (const [key, value] of Object.entries(attributes)) {
    records[key] = value?.slice()
  }
  return records
}

export function stringifyAttributes(
  attributes: Record<string, string[] | undefined> | undefined,
): string {
  if (!attributes) {
    return ''
  }
  const str = []
  for (const [key, value] of Object.entries(attributes)) {
    let attributeName = key
    if (attributeName.startsWith('gff_')) {
      attributeName = attributeName.slice(4)
      attributeName =
        attributeName.charAt(0).toUpperCase() + attributeName.slice(1)
    }
    if (value) {
      str.push(`${attributeName}=${value.join(',')}`)
    } else {
      str.push(attributeName)
    }
  }
  return encodeURIComponent(str.join(';'))
}
