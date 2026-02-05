/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { type Feature } from '@apollo-annotation/schemas'

import {
  Change,
  type ChangeOptions,
  type SerializedChange,
  isChange,
} from './Change.js'

export interface SerializedAssemblySpecificChange extends SerializedChange {
  assembly: string
}

export function isAssemblySpecificChange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  thing: any,
): thing is AssemblySpecificChange {
  return (
    isChange(thing) && (thing as AssemblySpecificChange).assembly !== undefined
  )
}

export abstract class AssemblySpecificChange extends Change {
  assembly: string

  constructor(json: SerializedAssemblySpecificChange, options?: ChangeOptions) {
    super(json, options)
    this.assembly = json.assembly
  }

  getIndexedIds(
    feature: AnnotationFeatureSnapshot | Feature,
    idsToIndex: string[] | undefined,
  ): string[] {
    const indexedIds: string[] = []
    for (const additionalId of idsToIndex ?? []) {
      const { attributes } = feature
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const idValue: string[] =
        attributes instanceof Map
          ? attributes.get(additionalId)
          : attributes?.[additionalId]
      if (idValue?.[0]) {
        indexedIds.push(idValue[0])
      }
    }
    if (feature.children) {
      const childrenIterable =
        feature.children instanceof Map
          ? feature.children.values()
          : Object.values(feature.children)
      for (const child of childrenIterable) {
        const childIndexedIds = this.getIndexedIds(child, idsToIndex)
        indexedIds.push(...childIndexedIds)
      }
    }
    return indexedIds
  }
}
