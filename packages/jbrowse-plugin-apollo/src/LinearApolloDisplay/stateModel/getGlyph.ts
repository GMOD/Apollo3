import { AnnotationFeature } from '@apollo-annotation/mst'

import { BoxGlyph, GeneGlyph, GenericChildGlyph } from '../glyphs'
import { Glyph } from '../glyphs/Glyph'

const boxGlyph = new BoxGlyph()
const geneGlyph = new GeneGlyph()
const genericChildGlyph = new GenericChildGlyph()

/** get the appropriate glyph for the given top-level feature */
export function getGlyph(feature: AnnotationFeature, _bpPerPx: number): Glyph {
  if (feature.type === 'gene') {
    return geneGlyph
  }
  if (feature.children?.size) {
    return genericChildGlyph
  }
  return boxGlyph
}
