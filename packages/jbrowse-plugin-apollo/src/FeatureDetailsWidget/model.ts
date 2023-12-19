import { AnnotationFeature } from 'apollo-mst'
import { types } from 'mobx-state-tree'

export const ApolloFeatureDetails = types.model('ApolloFeatureDetails', {
  feature: types.safeReference(AnnotationFeature),
})
