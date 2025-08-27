/* eslint-disable @typescript-eslint/unbound-method */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import { type BaseDisplayModel } from '@jbrowse/core/pluggableElementTypes'
import { getContainingView } from '@jbrowse/core/util'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

import { type LinearApolloDisplayMouseEvents } from '../LinearApolloDisplay/stateModel/mouseEvents'
import { type ApolloSessionModel } from '../session'
import { type MousePositionWithFeature } from '../util'

interface GoToAdjacentExonProps {
  session: ApolloSessionModel
  sourceFeature: AnnotationFeature
  selectedFeature?: AnnotationFeature
  display: LinearApolloDisplayMouseEvents
  mousePosition: MousePositionWithFeature
  getPrevious: boolean
}

function getAdjacentExon(
  transcript: AnnotationFeature,
  display: LinearApolloDisplayMouseEvents,
  mousePosition: MousePositionWithFeature,
  session: ApolloSessionModel,
  getPrevious: boolean,
): AnnotationFeature | undefined {
  const lgv = getContainingView(
    display as BaseDisplayModel,
  ) as unknown as LinearGenomeViewModel

  // Genomic coords of current view
  const viewGenomicLeft = mousePosition.bp - lgv.bpPerPx * mousePosition.x
  const viewGenomicRight = viewGenomicLeft + lgv.coarseTotalBp
  if (!transcript.children) {
    return undefined
  }
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }

  let exons = []
  for (const [, child] of transcript.children) {
    if (featureTypeOntology.isTypeOf(child.type, 'exon')) {
      exons.push(child)
    }
  }
  exons = getPrevious
    ? exons.sort((a, b) => (a.min > b.min ? -1 : 1))
    : exons.sort((a, b) => (a.min < b.min ? -1 : 1))

  for (const exon of exons) {
    if (!getPrevious && exon.min > viewGenomicRight) {
      return exon
    }
    if (getPrevious && exon.max < viewGenomicLeft) {
      return exon
    }
  }
  return undefined
}

export function GoToAdjacentExon({
  sourceFeature,
  display,
  session,
  mousePosition,
  getPrevious,
}: GoToAdjacentExonProps) {
  const lgv = getContainingView(
    display as BaseDisplayModel,
  ) as unknown as LinearGenomeViewModel
  lgv.scrollTo(lgv.scrollTo(10_000 / lgv.bpPerPx))
  console.log('DONE')
  // if (sourceFeature.parent) {
  //   const adjacentExon = getAdjacentExon(
  //     sourceFeature.parent,
  //     display,
  //     mousePosition,
  //     session,
  //     getPrevious,
  //   )
  //   if (adjacentExon) {
  //     lgv.scrollTo(lgv.scrollTo(adjacentExon.min / lgv.bpPerPx))
  //   }
  // }
  return null
}
