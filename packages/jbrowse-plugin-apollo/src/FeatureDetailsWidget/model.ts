import { AnnotationFeature } from 'apollo-mst'
import { types } from 'mobx-state-tree'
import { ElementId } from '@jbrowse/core/util/types/mst'

export const ApolloFeatureDetails = types.model('ApolloFeatureDetails', {
  id: ElementId,
  type: types.literal('ApolloFeatureDetails'),
  feature: types.safeReference(AnnotationFeature),
})
