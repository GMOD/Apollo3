import { AnnotationFeature } from '@apollo-annotation/mst'

import { boxGlyph, geneGlyph, genericChildGlyph } from '../glyphs'
import { Glyph } from '../glyphs/Glyph'

/** get the appropriate glyph for the given top-level feature */
export function getGlyph(feature: AnnotationFeature): Glyph {
  if (looksLikeGene(feature)) {
    return geneGlyph
  }
  if (feature.children?.size) {
    return genericChildGlyph
  }
  return boxGlyph
}

function looksLikeGene(feature: AnnotationFeature) {
  const { children } = feature
  if (!children?.size) {
    return false
  }
  for (const [, child] of children) {
    if (child.type === 'mRNA') {
      const { children: grandChildren } = child
      if (!grandChildren?.size) {
        return false
      }
      const hasCDS = [...grandChildren.values()].some(
        (grandchild) => grandchild.type === 'CDS',
      )
      const hasExon = [...grandChildren.values()].some(
        (grandchild) => grandchild.type === 'exon',
      )
      if (hasCDS && hasExon) {
        return true
      }
    }
  }
  return false
}
