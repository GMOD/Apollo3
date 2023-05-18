import { AnnotationFeatureI } from 'apollo-mst'

import { BoxGlyph, CanonicalGeneGlyph, ImplicitExonGeneGlyph } from '../glyphs'
import { Glyph } from '../glyphs/Glyph'

const boxGlyph = new BoxGlyph()
const canonicalGeneGlyph = new CanonicalGeneGlyph()
const implicitExonGeneGlyph = new ImplicitExonGeneGlyph()

/** get the appropriate glyph for the given top-level feature */
export function getGlyph(feature: AnnotationFeatureI, bpPerPx: number): Glyph {
  if (feature.type === 'gene') {
    let hasExon = false
    feature.children?.forEach((mrna: AnnotationFeatureI) => {
      if (mrna.type !== 'mRNA') {
        return
      }
      mrna.children?.forEach((possibleExon: AnnotationFeatureI) => {
        if (possibleExon.type === 'exon') {
          hasExon = true
        }
      })
    })
    if (hasExon) {
      return canonicalGeneGlyph
    }
    return implicitExonGeneGlyph
  }
  return boxGlyph
}
