import { AnnotationFeatureI } from 'apollo-mst'

import {
  BoxGlyph,
  CanonicalGeneGlyph,
  GenericChildGlyph,
  ImplicitExonGeneGlyph,
} from '../glyphs'
import { Glyph } from '../glyphs/Glyph'

const boxGlyph = new BoxGlyph()
const canonicalGeneGlyph = new CanonicalGeneGlyph()
const genericChildGlyph = new GenericChildGlyph()
const implicitExonGeneGlyph = new ImplicitExonGeneGlyph()

/** get the appropriate glyph for the given top-level feature */
export function getGlyph(feature: AnnotationFeatureI, _bpPerPx: number): Glyph {
  if (feature.type === 'gene') {
    let hasExon = false
    for (const [, mrna] of feature.children ?? new Map()) {
      if (mrna.type !== 'mRNA') {
        continue
      }
      for (const [, possibleExon] of mrna.children ?? new Map()) {
        if (possibleExon.type === 'exon') {
          hasExon = true
        }
      }
    }
    if (hasExon) {
      return canonicalGeneGlyph
    }
    return implicitExonGeneGlyph
  }
  if (feature.children?.size) {
    return genericChildGlyph
  }
  return boxGlyph
}
