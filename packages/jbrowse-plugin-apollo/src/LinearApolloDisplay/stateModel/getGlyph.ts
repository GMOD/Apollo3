import { AnnotationFeatureNew } from 'apollo-mst'

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
export function getGlyph(
  feature: AnnotationFeatureNew,
  _bpPerPx: number,
  synonyms: {
    geneSynonyms: string[]
    mRNASynonyms: string[]
    exonSynonyms: string[]
  },
): Glyph {
  const { exonSynonyms, geneSynonyms, mRNASynonyms } = synonyms

  if (geneSynonyms.includes(feature.type)) {
    let hasExon = false
    for (const [, mrna] of feature.children ?? new Map()) {
      if (!mRNASynonyms.includes(mrna.type)) {
        continue
      }
      for (const [, possibleExon] of mrna.children ?? new Map()) {
        if (exonSynonyms.includes(possibleExon.type)) {
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
