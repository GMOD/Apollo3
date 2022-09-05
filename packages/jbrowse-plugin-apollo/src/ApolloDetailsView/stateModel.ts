import PluginManager from '@jbrowse/core/PluginManager'
import { findParentThatIs, getContainingView } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { AnnotationFeatureI } from 'apollo-mst'
import { ChangeManager } from 'apollo-shared'
import { Instance, getParent, types } from 'mobx-state-tree'

import { ApolloViewModel, isClientDataStore } from '../ApolloView/stateModel'

export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('ApolloDetailsView', {
      id: ElementId,
      type: types.literal('ApolloDetailsView'),
    })
    .views((self) => ({
      get selectedFeature(): AnnotationFeatureI | undefined {
        return getParent<ApolloViewModel>(self).selectedFeature
      },
      getAssemblyId(feature: AnnotationFeatureI) {
        return findParentThatIs(feature, isClientDataStore).assemblyId
      },
      get changeManager() {
        const apolloView = getContainingView(self)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (apolloView as any).dataStore?.changeManager as
          | ChangeManager
          | undefined
      },
    }))
    .actions((self) => ({
      setSelectedFeature(feature?: AnnotationFeatureI) {
        getParent<ApolloViewModel>(self).setSelectedFeature(feature)
      },
    }))
}

export type ApolloDetailsViewStateModel = ReturnType<typeof stateModelFactory>
export type ApolloDetailsViewModel = Instance<ApolloDetailsViewStateModel>
