import { type AnnotationFeature } from '@apollo-annotation/mst'

export function getFeatureName(feature: AnnotationFeature) {
  const { attributes } = feature
  const name = attributes.get('gff_name')
  if (name) {
    return name[0]
  }
  return ''
}

export function getFeatureId(feature: AnnotationFeature) {
  const { attributes } = feature
  const id = attributes.get('gff_id')
  const transcript_id = attributes.get('transcript_id')
  const exon_id = attributes.get('exon_id')
  const protein_id = attributes.get('protein_id')
  if (id) {
    return id[0]
  }
  if (transcript_id) {
    return transcript_id[0]
  }
  if (exon_id) {
    return exon_id[0]
  }
  if (protein_id) {
    return protein_id[0]
  }
  return ''
}

export function getFeatureNameOrId(feature: AnnotationFeature) {
  const name = getFeatureName(feature)
  const id = getFeatureId(feature)
  if (name) {
    return `: ${name}`
  }
  if (id) {
    return `: ${id}`
  }
  return ''
}

export function getStrand(strand: number | undefined) {
  if (strand === 1) {
    return 'Forward'
  }
  if (strand === -1) {
    return 'Reverse'
  }
  return ''
}

function getChildren(feature: AnnotationFeature): AnnotationFeature[] {
  const children: AnnotationFeature[] = []
  //
  if (feature.children) {
    for (const [, ff] of feature.children) {
      children.push(ff)
    }
  }
  return children
}

function getParents(feature: AnnotationFeature): AnnotationFeature[] {
  const parents: AnnotationFeature[] = []
  let { parent } = feature
  while (parent) {
    parents.push(parent)
    ;({ parent } = parent)
  }
  return parents
}

export function getRelatedFeatures(
  feature: AnnotationFeature,
  bp: number,
  includeSiblings = false,
): AnnotationFeature[] {
  const relatedFeatures: AnnotationFeature[] = []
  relatedFeatures.push(feature)
  for (const x of getParents(feature)) {
    relatedFeatures.push(x)
  }
  const children = getChildren(feature)
  for (const child of children) {
    if (child.min < bp && child.max >= bp) {
      relatedFeatures.push(child)
    }
  }
  if (!includeSiblings) {
    return relatedFeatures
  }

  // Also add siblings , i.e. features having the same parent as the clicked
  // one and intersecting the click position
  if (feature.parent) {
    const siblings = feature.parent.children
    if (siblings) {
      for (const [, sib] of siblings) {
        if (sib._id == feature._id) {
          continue
        }
        if (sib.min < bp && sib.max >= bp) {
          relatedFeatures.push(sib)
        }
      }
    }
  }
  return relatedFeatures
}
