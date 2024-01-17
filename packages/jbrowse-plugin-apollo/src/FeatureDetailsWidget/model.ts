import { ElementId } from '@jbrowse/core/util/types/mst'
import { AnnotationFeature } from 'apollo-mst'
import { types } from 'mobx-state-tree'

import { ChangeManager } from '../ChangeManager'

export const ApolloFeatureDetails = types.model('ApolloFeatureDetails', {
  id: ElementId,
  type: types.literal('ApolloFeatureDetails'),
  feature: types.safeReference(AnnotationFeature),
  assembly: types.string,
  refName: types.string,
  changeManager: types.frozen<ChangeManager>(),
})
