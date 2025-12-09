/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

import {
  Change,
  type ChangeOptions,
  type SerializedChange,
  isChange,
} from './Change'

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
    feature: AnnotationFeatureSnapshot,
    idsToIndex: string[] | undefined,
  ): string[] {
    const indexedIds: string[] = []
    for (const additionalId of idsToIndex ?? []) {
      const idValue = feature.attributes?.[additionalId]
      if (idValue) {
        indexedIds.push(idValue[0])
      }
    }
    if (feature.children) {
      for (const child of Object.values(feature.children)) {
        const childIndexedIds = this.getIndexedIds(child, idsToIndex)
        indexedIds.push(...childIndexedIds)
      }
    }
    return indexedIds
  }
}
