import { type AnnotationFeature } from '@apollo-annotation/mst'

import { type MousePosition } from '../LinearApolloDisplay/stateModel/mouseEvents'

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

export function getFeaturesUnderClick(
  mousePosition: MousePosition,
  includeSiblings = false,
): AnnotationFeature[] {
  const clickedFeatures: AnnotationFeature[] = []
  if (!mousePosition.feature) {
    return clickedFeatures
  }
  clickedFeatures.push(mousePosition.feature)
  for (const x of getParents(mousePosition.feature)) {
    clickedFeatures.push(x)
  }
  const { bp } = mousePosition
  const children = getChildren(mousePosition.feature)
  for (const child of children) {
    if (child.min < bp && child.max >= bp) {
      clickedFeatures.push(child)
    }
  }
  if (!includeSiblings) {
    return clickedFeatures
  }

  // Also add siblings , i.e. features having the same parent as the clicked
  // one and intersecting the click position
  if (mousePosition.feature.parent) {
    const siblings = mousePosition.feature.parent.children
    if (siblings) {
      for (const [, sib] of siblings) {
        if (sib._id == mousePosition.feature._id) {
          continue
        }
        if (sib.min < bp && sib.max >= bp) {
          clickedFeatures.push(sib)
        }
      }
    }
  }
  return clickedFeatures
}
