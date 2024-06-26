/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { AnnotationFeature } from '@apollo-annotation/mst'

import {
  BoxGlyph,
  CanonicalGeneGlyph,
  GenericChildGlyph,
} from '../glyphs'
import { Glyph } from '../glyphs/Glyph'

const boxGlyph = new BoxGlyph()
const canonicalGeneGlyph = new CanonicalGeneGlyph()
const genericChildGlyph = new GenericChildGlyph()

/** get the appropriate glyph for the given top-level feature */
export function getGlyph(feature: AnnotationFeature, _bpPerPx: number): Glyph {
  if (feature.type === 'gene') {

      return canonicalGeneGlyph

  }
  if (feature.children?.size) {
    return genericChildGlyph
  }
  return boxGlyph
}
