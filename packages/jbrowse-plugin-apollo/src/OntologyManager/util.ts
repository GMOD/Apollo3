import { AnnotationFeature } from '@apollo-annotation/mst'

import OntologyStore from './OntologyStore'
import { isOntologyClass } from '.'

export async function fetchValidDescendantTerms(
  parentFeature: AnnotationFeature | undefined,
  ontologyStore: OntologyStore,
  _signal: AbortSignal,
) {
  if (!parentFeature) {
    return
  }
  // since this is a child of an existing feature, restrict the autocomplete choices to valid
  // parts of that feature
  const parentTypeTerms = await ontologyStore.getTermsWithLabelOrSynonym(
    parentFeature.type,
    { includeSubclasses: false },
  )
  // eslint-disable-next-line unicorn/no-array-callback-reference
  const parentTypeClassTerms = parentTypeTerms.filter(isOntologyClass)
  if (parentTypeTerms.length === 0) {
    return
  }
  const subpartTerms = await ontologyStore.getClassesThat(
    'part_of',
    parentTypeClassTerms,
  )
  if (subpartTerms.length === 0) {
    return
  }
  return subpartTerms
}
