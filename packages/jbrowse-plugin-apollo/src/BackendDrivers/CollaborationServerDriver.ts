import gff3, { GFF3FeatureLineWithRefs, GFF3Item } from '@gmod/gff'
import { Region, doesIntersect2 } from '@jbrowse/core/util'
import { SnapshotIn } from 'mobx-state-tree'

import gff3File from '../ApolloView/components/volvoxGff3'
import AnnotationFeature from '../BackendDrivers/AnnotationFeature'
import { Change } from '../ChangeManager/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'
import { BackendDriver } from './BackendDriver'

const volvoxGFF3Contents = gff3.parseStringSync(gff3File, {
  parseAll: true,
})

export class CollaborationServerDriver extends BackendDriver {
  private allFeatures = makeFeatures(volvoxGFF3Contents, 'volvox')

  async getFeatures(region: Region) {
    const { refName } = region
    const featuresForRefName = this.allFeatures[refName]
    if (!featuresForRefName) {
      return { [refName]: {} }
    }
    const featuresForRegion: Record<
      string,
      SnapshotIn<typeof AnnotationFeature> | undefined
    > = {}
    Object.entries(featuresForRefName).forEach(([featureId, feature]) => {
      if (!feature) {
        return
      }
      if (
        doesIntersect2(
          region.start,
          region.end,
          feature.location.start,
          feature.location.end,
        )
      ) {
        featuresForRegion[featureId] = feature
      }
    })
    return { [refName]: featuresForRefName }
  }

  async getSequence(region: Region) {
    throw new Error('getSequence not yet implemented')
    return ''
  }

  async getRefNames() {
    return Array.from(Object.keys(this.allFeatures))
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
