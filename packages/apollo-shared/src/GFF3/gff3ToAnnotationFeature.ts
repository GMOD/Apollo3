import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { GFF3Feature, GFF3FeatureLineWithRefs } from '@gmod/gff'
import { doesIntersect2 } from '@jbrowse/core/util'
import ObjectID from 'bson-objectid'

import { gffToInternal, isGFFReservedAttribute } from './gffReservedKeys'

export function gff3ToAnnotationFeature(
  gff3Feature: GFF3Feature,
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
    type,
    min,
    max,
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
  if (convertedChildren) {
    feature.children = convertedChildren
  }
  if (convertedAttributes) {
    feature.attributes = convertedAttributes
  }
  if (featureIds) {
    featureIds.push(feature._id)
  }
  return feature
}

function getFeatureMinMax(gff3Feature: GFF3Feature): [number, number] {
  if (gff3Feature.length > 1 && !gff3Feature.every((f) => f.type === 'CDS')) {
    throw new Error('GFF3 features has multiple locations but is not a CDS')
  }
  const mins = gff3Feature.map((f) => f.start).filter((m) => m !== null)
  const maxes = gff3Feature.map((f) => f.end).filter((m) => m !== null)
  const min = Math.min(...mins)
  const max = Math.max(...maxes)
  return [min - 1, max]
}

function convertFeatureAttributes(
  gff3Feature: GFF3Feature,
): Record<string, string[] | undefined> | undefined {
  const convertedAttributes: Record<string, string[] | undefined> | undefined =
    {}
  const scores = gff3Feature
    .map((f) => f.score)
    .filter((score) => score !== null)
  const sources = gff3Feature
    .map((f) => f.source)
    .filter((source) => source !== null)
  const attributesCollections = gff3Feature
    .map((f) => f.attributes)
    .filter((attributes) => attributes !== null)
  if (scores.length > 0) {
    let [score] = scores
    if (scores.length > 1) {
      const scoresSum = scores.reduce(
        (accumulator, currentValue) => accumulator + currentValue,
        0,
      )
      // Average score
      score = scoresSum / scores.length
    }
    convertedAttributes.gff_score = [String(score)]
  }
  if (sources.length > 0) {
    let [source] = sources
    if (sources.length > 1) {
      const sourceSet = new Set(sources)
      source = [...sourceSet].join(',')
    }
    convertedAttributes.gff_source = [source]
  }
  if (attributesCollections.length > 0) {
    for (const attributesCollection of attributesCollections) {
      for (const [key, val] of Object.entries(attributesCollection)) {
        if (!val || key === 'Parent') {
          continue
        }
        const newKey = isGFFReservedAttribute(key) ? gffToInternal[key] : key
        const existingVal = convertedAttributes[newKey]
        if (existingVal) {
          // if (JSON.stringify(existingVal) === JSON.stringify(val)) {
          //   continue
          // }
          const valSet = new Set([...existingVal, ...val])
          convertedAttributes[newKey] = [...valSet]
        } else {
          convertedAttributes[newKey] = val
        }
      }
    }
  }
  if (Object.keys(convertedAttributes).length > 0) {
    return convertedAttributes
  }
  return
}

function convertChildren(
  gff3Feature: GFF3Feature,
  refSeq?: string,
  featureIds?: string[],
): Record<string, AnnotationFeatureSnapshot> | undefined {
  const convertedChildren: Record<string, AnnotationFeatureSnapshot> = {}
  const locationsWithChildren = gff3Feature.filter(
    (feature) => feature.child_features.length > 0,
  )
  if (locationsWithChildren.length > 1) {
    throw new Error('Features with multiple locations may not have children')
  }
  if (locationsWithChildren.length === 0) {
    return
  }
  const [firstFeature] = locationsWithChildren
  const { child_features: childFeatures } = firstFeature

  const cdsFeatures: GFF3Feature[] = []
  const exonFeatures: GFF3Feature[] = []
  const utrFeatures: GFF3Feature[] = []
  for (const childFeature of childFeatures) {
    const [firstChildFeatureLocation] = childFeature
    if (firstChildFeatureLocation.type === 'exon') {
      exonFeatures.push(childFeature)
    }
    if (
      firstChildFeatureLocation.type === 'three_prime_UTR' ||
      firstChildFeatureLocation.type === 'five_prime_UTR'
    ) {
      utrFeatures.push(childFeature)
    }
    if (
      firstChildFeatureLocation.type === 'three_prime_UTR' ||
      firstChildFeatureLocation.type === 'five_prime_UTR' ||
      firstChildFeatureLocation.type === 'intron' ||
      firstChildFeatureLocation.type === 'start_codon' ||
      firstChildFeatureLocation.type === 'stop_codon'
    ) {
      continue
    }
    if (firstChildFeatureLocation.type === 'CDS') {
      cdsFeatures.push(childFeature)
    } else {
      const child = gff3ToAnnotationFeature(childFeature, refSeq, featureIds)
      convertedChildren[child._id] = child
    }
  }

  if (cdsFeatures.length > 0) {
    const processedCDS = processCDS(cdsFeatures, refSeq, featureIds)

    for (const cds of processedCDS) {
      convertedChildren[cds._id] = cds
    }

    const missingExons = inferMissingExons(
      cdsFeatures,
      exonFeatures,
      utrFeatures,
      processedCDS[0].refSeq,
    )
    for (const exon of missingExons) {
      convertedChildren[exon._id] = exon
    }
  }

  if (Object.keys(convertedChildren).length > 0) {
    return convertedChildren
  }
  return
}

function inferMissingExons(
  cdsFeatures: GFF3Feature[],
  existingExons: GFF3Feature[],
  utrFeatures: GFF3Feature[],
  refSeq: string,
): AnnotationFeatureSnapshot[] {
  // Convert utrFeatures from GFF3Feature to AnnotationFeatureSnapshot
  const utrExons: AnnotationFeatureSnapshot[] = []
  for (const utrs of utrFeatures) {
    for (const utr of utrs) {
      if (!utr.start || !utr.end) {
        throw new Error(
          `UTR has undefined start and/or end\n: ${JSON.stringify(utr, null, 2)}`,
        )
      }
      let strand: 1 | -1 | undefined = undefined
      if (utr.strand === '+') {
        strand = 1
      } else if (utr.strand === '-') {
        strand = -1
      }
      utrExons.push({
        _id: new ObjectID().toHexString(),
        refSeq,
        type: 'exon',
        min: utr.start - 1,
        max: utr.end,
        strand,
      })
    }
  }
  utrExons.sort((a, b) => a.min - b.min)

  const missingExons: AnnotationFeatureSnapshot[] = []
  for (const protein of cdsFeatures) {
    protein.sort((a, b) => {
      if (!a.start || !b.start) {
        throw new Error('CDS has undefined start')
      }
      return a.start - b.start
    })
    for (let cdsIdx = 0; cdsIdx < protein.length; cdsIdx++) {
      const cds = protein[cdsIdx]
      // For CDS check if there is an exon containing it. If not, create an exon with same coords as the CDS.
      let exonFound = false
      for (const x of existingExons) {
        if (x.length != 1) {
          throw new Error('Unexpected number of exons')
        }
        const [exon] = x
        if (
          exon.start &&
          exon.end &&
          cds.start &&
          cds.end &&
          exon.start <= cds.start &&
          exon.end >= cds.end
        ) {
          exonFound = true
          break
        }
      }
      if (!exonFound) {
        if (!cds.start || !cds.end) {
          throw new Error(
            `CDS has undefined start and/or end: ${JSON.stringify(cds, null, 2)}`,
          )
        }
        let strand: 1 | -1 | undefined = undefined
        if (cds.strand === '+') {
          strand = 1
        } else if (cds.strand === '-') {
          strand = -1
        }
        const newExon: AnnotationFeatureSnapshot = {
          _id: new ObjectID().toHexString(),
          refSeq,
          type: 'exon',
          min: cds.start - 1,
          max: cds.end,
          strand,
        }
        if (cdsIdx === 0) {
          // If this CDS is the leftmost (or the only CDS in this protein), check if we need to add UTRs before it
          for (const utr of utrExons) {
            if (utr.max > newExon.min) {
              break
            }
            if (utr.max === newExon.min) {
              // UTR ends where exon begins: Extend the exon to include this UTR
              newExon.min = utr.min
            } else {
              missingExons.push(utr)
            }
          }
        }
        if (cdsIdx === protein.length - 1) {
          // If this CDS is the rightmost (or the only CDS in this protein), check if we need to add UTRs after it
          for (const utr of utrExons) {
            if (utr.min < newExon.max) {
              continue
            }
            if (utr.min === newExon.max) {
              // UTR begins where exon end: Extend the exon to include this UTR
              newExon.max = utr.max
            } else {
              missingExons.push(utr)
            }
          }
        }
        missingExons.push(newExon)
      }
    }
  }
  const mergedExons = mergeAnnotationFeatures(missingExons)
  return mergedExons
}

function mergeAnnotationFeatures(
  features: AnnotationFeatureSnapshot[],
): AnnotationFeatureSnapshot[] {
  if (features.length === 0) {
    return []
  }
  features.sort((a, b) => a.min - b.min)

  const res = []
  res.push(features[0])

  for (let i = 1; i < features.length; i++) {
    const last = res.at(-1)
    const curr = features[i]

    // If current interval overlaps with the last merged interval, merge them
    if (last && curr.min <= last.max) {
      last.max = Math.max(last.max, curr.max)
    } else {
      res.push(curr)
    }
  }
  return res
}

/**
 * If a GFF3 file has CDS features that either (1) don't have an ID or (2) have
 * different IDs for each CDS, we have to do a bit of guessing about how they
 * should be represented in our internal structure
 * @param cdsFeatures -
 */
function processCDS(
  cdsFeatures: GFF3Feature[],
  refSeq?: string,
  featureIds?: string[],
): AnnotationFeatureSnapshot[] {
  const locationCounts = cdsFeatures.map((cds) => cds.length)
  // If any CDS have multiple locations, assume it really is multiple CDS
  // (e.g. the mRNA has multiple alternative translational start sites)
  // and process normally.
  if (locationCounts.some((count) => count > 1)) {
    return cdsFeatures.map((cds) =>
      gff3ToAnnotationFeature(cds, refSeq, featureIds),
    )
  }
  // If all CDS have a single location, we guess that this GFF3 represented CDS
  // as multiple features instead of a single feature with multiple locations.
  // To figure out if it's actually representing one vs. multiple CDS features,
  // first check to see if any of the CDS overlap
  const sortedCDSLocations = cdsFeatures
    .map((cds) => cds[0])
    .filter((cds) => cds.start !== null && cds.end !== null)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .sort((cdsA, cdsB) => cdsA.start! - cdsB.start!)
  const overlapping = sortedCDSLocations.some((loc, idx) => {
    const nextLoc = sortedCDSLocations.at(idx + 1)
    if (!nextLoc) {
      return false
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return doesIntersect2(loc.start!, loc.end!, nextLoc.start!, nextLoc.end!)
  })
  // If no overlaps, assume it's a single CDS feature
  if (!overlapping) {
    return [gff3ToAnnotationFeature(sortedCDSLocations, refSeq, featureIds)]
  }
  // Some CDS locations overlap, the best we can do is use the original order to
  // guess how to group the locations into features
  const cdsLocations = cdsFeatures.map((cds) => cds[0])
  const groupedLocations: GFF3FeatureLineWithRefs[][] = []
  for (const location of cdsLocations) {
    const lastGroup = groupedLocations.at(-1)
    if (!lastGroup) {
      groupedLocations.push([location])
      continue
    }
    const overlaps = lastGroup.some((lastGroupLoc) =>
      doesIntersect2(
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        lastGroupLoc.start!,
        lastGroupLoc.end!,
        location.start!,
        location.end!,
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
      ),
    )
    if (overlaps) {
      groupedLocations.push([location])
    } else {
      lastGroup.push(location)
    }
  }
  return groupedLocations.map((group) =>
    gff3ToAnnotationFeature(group, refSeq, featureIds),
  )
}
