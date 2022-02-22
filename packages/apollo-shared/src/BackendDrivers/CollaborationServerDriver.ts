import { GFF3FeatureLineWithRefs, GFF3Item } from '@gmod/gff'
import { Region } from '@jbrowse/core/util'
import { SnapshotIn } from 'mobx-state-tree'

import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
import { Change } from '../ChangeManager/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'
import { BackendDriver } from './BackendDriver'

export class CollaborationServerDriver extends BackendDriver {
  /**
   * Call backend endpoint to get features by criteria
   * @param region -  Searchable region containing refName, start and end
   * @returns
   */
  async getFeatures(region: Region) {
    const { refName, start, end } = region

    // console.log(`In CollaborationServerDriver: Query parameters: refName=${refName}, start=${start}, end=${end}`)
    const url = new URL(
      'http://localhost:3999/filehandling/getFeaturesByCriteria',
    )
    const paramsString = `seq_id=${refName}&start=${start}&end=${end}`
    const searchParams = new URLSearchParams(paramsString)
    url.search = searchParams.toString()

    const result = await fetch(url.toString())
    const data = (await result.json()) as GFF3Item[]
    // const backendResult = JSON.stringify(data)
    // console.log(
    //   `In CollaborationServerDriver: Backend endpoint returned=${backendResult}`,
    // )
    const allFeatures = makeFeatures(data, 'volvox')

    return { [refName]: allFeatures[refName] }
  }

  async getSequence(region: Region) {
    throw new Error('getSequence not yet implemented')
    return ''
  }

  async getRefNames() {
    throw new Error('getRefNames not yet implemented')
    return []
  }

  async submitChange(change: Change) {
    return new ValidationResultSet()
  }
}

function makeFeatures(gff3Contents: GFF3Item[], assemblyName: string) {
  const featuresByRefName: Record<
    string,
    Record<string, SnapshotIn<typeof AnnotationFeature> | undefined> | undefined
  > = {}
  for (const gff3Item of gff3Contents) {
    if (Array.isArray(gff3Item)) {
      gff3Item.forEach((feature, idx) => {
        if (!feature.seq_id) {
          throw new Error('Got GFF3 record without an ID')
        }
        if (!feature.type) {
          throw new Error('Got GFF3 record without a type')
        }
        const convertedFeature = convertFeature(feature, idx, assemblyName)
        const { refName } = convertedFeature.location
        let refRecord = featuresByRefName[refName]
        if (!refRecord) {
          refRecord = {}
          featuresByRefName[refName] = refRecord
        }
        refRecord[convertedFeature.id] = convertedFeature
      })
    }
  }
  return featuresByRefName
}

function convertFeature(
  feature: GFF3FeatureLineWithRefs,
  idx: number,
  assemblyName: string,
): SnapshotIn<typeof AnnotationFeature> {
  if (!feature.seq_id) {
    throw new Error('Got GFF3 record without an ID')
  }
  if (!feature.type) {
    throw new Error('Got GFF3 record without a type')
  }
  if (!feature.start) {
    throw new Error('Got GFF3 record without a start')
  }
  if (!feature.end) {
    throw new Error('Got GFF3 record without an end')
  }
  const attributeID = feature.attributes?.ID?.[0]
  const id = attributeID ? `${attributeID}-${idx}` : objectHash(feature)
  const children: Record<string, SnapshotIn<typeof AnnotationFeature>> = {}
  feature.child_features.forEach((childFeatureLocation) => {
    childFeatureLocation.forEach((childFeature, idx2) => {
      const childFeat = convertFeature(childFeature, idx2, assemblyName)
      children[childFeat.id] = childFeat
    })
  })
  const newFeature: SnapshotIn<typeof AnnotationFeature> = {
    id,
    assemblyName,
    location: {
      refName: feature.seq_id,
      start: feature.start,
      end: feature.end,
    },
  }
  if (Array.from(Object.entries(children)).length) {
    newFeature.children = children
  }
  return newFeature
}

function hashCode(str: string): string {
  let hash = 0
  let i
  let chr
  if (str.length === 0) {
    return '0'
  }
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return String(hash)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function objectHash(obj: Record<string, any>) {
  return `${hashCode(JSON.stringify(obj))}`
}
