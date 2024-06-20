import { GFF3Feature } from '@gmod/gff'
import { AnnotationFeatureSnapshotNew } from 'apollo-mst'
import ObjectID from 'bson-objectid'

import { gffToInternal, isGFFReservedAttribute } from './gffReservedKeys'

export function gff3ToAnnotationFeature(
  gff3Feature: GFF3Feature,
  refSeq?: string,
  featureIds?: string[],
): AnnotationFeatureSnapshotNew {
  const [firstFeature] = gff3Feature
  const {
    attributes,
    child_features: childFeatures,
    end,
    score,
    seq_id: refName,
    source,
    start,
    strand,
    type,
  } = firstFeature
  if (!refName) {
    throw new Error(
      `feature does not have seq_id: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (!type) {
    throw new Error(
      `feature does not have type: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (start === null) {
    throw new Error(
      `feature does not have start: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (end === null) {
    throw new Error(
      `feature does not have end: ${JSON.stringify(firstFeature)}`,
    )
  }
  const feature: AnnotationFeatureSnapshotNew = {
    _id: new ObjectID().toHexString(),
    refSeq: refSeq ?? refName,
    type,
    min: start - 1,
    max: end,
  }

  if (gff3Feature.length > 1) {
    if (type !== 'CDS') {
      throw new Error('GFF3 features has multiple locations but is not a CDS')
    }
    const mins = gff3Feature
      .map((f) => {
        if (f.start === null) {
          throw new Error(`feature does not have start: ${JSON.stringify(f)}`)
        }
        return f.start - 1
      })
      .filter<number>((m): m is number => m !== null)
    const maxes = gff3Feature
      .map((f) => f.end)
      .filter<number>((m): m is number => m !== null)
    feature.min = Math.min(...mins)
    feature.max = Math.max(...maxes)
  }

  if (strand) {
    if (strand === '+') {
      feature.strand = 1
    } else if (strand === '-') {
      feature.strand = -1
    } else {
      throw new Error(`Unknown strand: "${strand}"`)
    }
  }
  if (featureIds) {
    featureIds.push(feature._id as string)
  }

  // console.log(`++++ CHILD FEATURES PITUUS: ${childFeatures.length} `)
  if (childFeatures?.length) {
    const children: Record<string, AnnotationFeatureSnapshotNew> = {}
    for (const childFeature of childFeatures) {
      // console.log(`+++ childFeature: ${JSON.stringify(childFeature)}`)
      if (childFeature[0].type === 'three_prime_UTR' || childFeature[0].type === 'five_prime_UTR') {
        console.log(`-++++++ CHILD FEATURE OLI UTR: ${JSON.stringify(childFeature[0])}`)
        continue
      }
      const child = refSeq ? gff3ToAnnotationFeature(childFeature, refSeq, featureIds) : gff3ToAnnotationFeature(childFeature);
      children[child._id] = child
      // Add value to gffId
      if (child.attributes) {
        child.attributes.gffId = [child._id]
      }
    }
    feature.children = children
  }
  if (score ?? source ?? attributes) {
    const attrs: Record<string, string[]> = {}
    if (source) {
      attrs.gff_source = [source]
    }
    if (score !== null) {
      attrs.gff_score = [String(score)]
    }
    if (attributes) {
      for (const [key, val] of Object.entries(attributes)) {
        if (!val) {
          continue
        }
        // AO. KOODI ERILAINEN MUTTA TOIMINEE KUTEN CREATEFEATUREN FUNKTIOSSA
        if (isGFFReservedAttribute(key)) {
          if (key === 'Parent') {
            continue
          }
          attrs[gffToInternal[key]] = val
        }
      }
    }
    feature.attributes = attrs
  }
  return feature
}