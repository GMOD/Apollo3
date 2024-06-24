import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { GFF3Feature, GFF3FeatureLineWithRefs } from '@gmod/gff'
import { doesIntersect2 } from '@jbrowse/core/util'
import ObjectID from 'bson-objectid'

import { gffToInternal, isGFFReservedAttribute } from './gffReservedKeys'

export function gff3ToAnnotationFeature(
  gff3Feature: GFF3Feature,
  refSeq?: string,
  featureIds?: string[],
  refSeq?: string,
  featureIds?: string[],
): AnnotationFeatureSnapshot {
  const [firstFeature] = gff3Feature
  const { end, seq_id: refName, start, strand, type } = firstFeature
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

  const [min, max] = getFeatureMinMax(gff3Feature)

  const convertedChildren = convertChildren(gff3Feature, refSeq, featureIds)

  const convertedAttributes = convertFeatureAttributes(gff3Feature)

  const feature: AnnotationFeatureSnapshot = {
    _id: new ObjectID().toHexString(),
    refSeq: refSeq ?? refName,
    refSeq: refSeq ?? refName,
    type,
    min: start - 1,
    max: end,
  }

  if (gff3Feature.length > 1) {
    if (type !== 'CDS') {
      throw new Error('GFF3 features has multiple locations but is not a CDS')
    }
    const mins = gff3Feature.map((f) => {
      if (f.start === null) {
        throw new Error(`feature does not have start: ${JSON.stringify(f)}`)
      }
      return f.start - 1
    })
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

if (childFeatures.length > 0) {
  const children: Record<string, AnnotationFeatureSnapshot> = {}
  let _containsCDS = false
    let _cdsParent
    let _cdsFeature
    let _cdsID
    let _cdsMin=0
    for (const childFeature of childFeatures) {
      if (childFeature[0].type === 'three_prime_UTR' || childFeature[0].type === 'five_prime_UTR') {
        continue
      }
      if (childFeature[0].type === 'CDS') {
        if (_cdsParent) {
          if (childFeature[0].attributes?.Parent && childFeature[0].attributes?.ID) {
            if (_cdsParent === childFeature[0].attributes.Parent[0]) {
              _cdsID += ',' +  childFeature[0].attributes?.ID
              _cdsFeature = JSON.parse(JSON.stringify(childFeature))
              if (_cdsID && _cdsFeature[0].attributes?.ID) {
                _cdsFeature[0].attributes.ID[0] = _cdsID
              }
              continue
            }
          }
        } else {
          // eslint-disable-next-line prefer-destructuring
          _cdsFeature = JSON.parse(JSON.stringify(childFeature))
          if (childFeature[0].attributes?.Parent && childFeature[0].attributes?.ID) {
            _cdsParent = childFeature[0].attributes?.Parent[0] // Set CDS parent
            _cdsID = childFeature[0].attributes?.ID[0]
            _cdsMin = childFeature[0].start ?? 0
          }
        }
        _containsCDS = true
        continue
      }
      const child = refSeq ? gff3ToAnnotationFeature(childFeature, refSeq, featureIds) : gff3ToAnnotationFeature(childFeature)
      children[child._id] = child
      // Add value to gffId
      if (child.attributes) {
        child.attributes.gffId = [child._id]
      }
    }
    // Process previous combined CDS feature if any
    if (_cdsFeature) {
      _cdsFeature[0].start = _cdsMin
      _cdsFeature.start = _cdsMin
      const child = refSeq ? gff3ToAnnotationFeature(_cdsFeature, refSeq, featureIds) : gff3ToAnnotationFeature(_cdsFeature);
      children[child._id] = child
      // Add value to gffId
      if (child.attributes) {
        child.attributes.gffId = [child._id]
      }
      _cdsFeature = undefined
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
