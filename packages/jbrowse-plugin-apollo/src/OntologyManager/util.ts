import { AnnotationFeature } from '@apollo-annotation/mst'

import OntologyStore from './OntologyStore'
import { ApolloSessionModel } from '../session'

export async function fetchValidDescendantTerms(
  parentFeature: AnnotationFeature | undefined,
  ontologyStore: OntologyStore,
  session: ApolloSessionModel,
  _signal: AbortSignal,
) {
  if (!parentFeature) {
    return
  }

  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }

  const isGene = featureTypeOntology.isTypeOf(parentFeature.type, 'gene')
  const isTranscript = featureTypeOntology.isTypeOf(
    parentFeature.type,
    'transcript',
  )
  const isCDS = featureTypeOntology.isTypeOf(parentFeature.type, 'CDS')
  const isExon = featureTypeOntology.isTypeOf(parentFeature.type, 'exon')

  let terms
  if (isGene) {
    terms = await ontologyStore.getTermsWithLabelOrSynonym('gene', {
      includeSubclasses: true,
    })
  }
  if (isTranscript) {
    terms = await ontologyStore.getTermsWithLabelOrSynonym('transcript', {
      includeSubclasses: true,
    })
  }
  if (isExon) {
    terms = await ontologyStore.getTermsWithLabelOrSynonym('exon', {
      includeSubclasses: true,
    })
  }
  if (isCDS) {
    terms = await ontologyStore.getTermsWithLabelOrSynonym('CDS', {
      includeSubclasses: true,
    })
  }

  return terms
}
