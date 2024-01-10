import { AnnotationFeature, ApolloAssembly } from 'apollo-mst'
import { types } from 'mobx-state-tree'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  AbstractSessionModel,
} from '@jbrowse/core/util'
import { ApolloSessionModel } from '../session'
import { ChangeManager } from '../ChangeManager'
export const ApolloFeatureDetails = types.model('ApolloFeatureDetails', {
  id: ElementId,
  type: types.literal('ApolloFeatureDetails'),
  feature: types.safeReference(AnnotationFeature),
  assembly: types.string,
  changeManager: types.frozen<ChangeManager>(),
  // session: types.frozen<ApolloSessionModel>(), 
  // session: types.frozen<AbstractSessionModel>(), 
  // session: types.model({})
})
