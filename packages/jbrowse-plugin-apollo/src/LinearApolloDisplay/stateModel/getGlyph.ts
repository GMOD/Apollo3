import { AnnotationFeature } from '@apollo-annotation/mst'

import { boxGlyph, geneGlyph, genericChildGlyph } from '../glyphs'
import { Glyph } from '../glyphs/Glyph'
import { getSession } from '@jbrowse/core/util'
import { ApolloSessionModel } from '../../session'

/** get the appropriate glyph for the given top-level feature */
export async function getGlyph(feature: AnnotationFeature): Promise<Glyph> {
  if (await looksLikeGene(feature)) {
    return geneGlyph
  }
  if (feature.children?.size) {
    return genericChildGlyph
  }
  return boxGlyph
}

async function looksLikeGene(feature: AnnotationFeature) {
  const { children } = feature
  if (!children?.size) {
    return false
  }
  const session = getSession(feature) as unknown as ApolloSessionModel

  for (const [, child] of children) {
    if (
      await session.apolloDataStore.ontologyManager.isTypeOf(child.type, 'mRNA')
    ) {
      const { children: grandChildren } = child
      if (!grandChildren?.size) {
        return false
      }
      let hasCDS = false
      let hasExon = false
      for (const grandchild of grandChildren.values()) {
        if (
          !hasCDS &&
          (await session.apolloDataStore.ontologyManager.isTypeOf(
            grandchild.type,
            'CDS',
          ))
        ) {
          hasCDS = true
        }
        if (
          !hasExon &&
          (await session.apolloDataStore.ontologyManager.isTypeOf(
            grandchild.type,
            'exon',
          ))
        ) {
          hasExon = true
        }
      }
      if (hasCDS && hasExon) {
        return true
      }
    }
  }
  return false
}
