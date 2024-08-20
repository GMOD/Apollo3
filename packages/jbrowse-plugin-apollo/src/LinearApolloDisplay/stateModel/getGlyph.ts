import { AnnotationFeature } from '@apollo-annotation/mst'

import { boxGlyph, geneGlyph, genericChildGlyph } from '../glyphs'
import { Glyph } from '../glyphs/Glyph'

/** get the appropriate glyph for the given top-level feature */
export function getGlyph(feature: AnnotationFeature): Glyph {
  if (feature.type === 'gene') {
    return geneGlyph
  }
  if (feature.children?.size) {
    return genericChildGlyph
  }
  return boxGlyph
}
