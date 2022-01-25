import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import { Instance, SnapshotIn, types } from 'mobx-state-tree'

import AnnotationFeature from '../BackendDrivers/AnnotationFeature'

export function stateModelFactory(pluginManager: PluginManager) {
  const FeatureMap = types.map(AnnotationFeature)
  const RefNameMap = types.map(FeatureMap)
  return types
    .model({
      type: types.literal('ApolloView'),
      linearGenomeView: pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel,
      features: RefNameMap,
    })
    .views((self) => ({
      get width() {
        return self.linearGenomeView.width
      },
    }))
    .actions((self) => ({
      setWidth(newWidth: number) {
        self.linearGenomeView.setWidth(newWidth)
      },
      setFeatures(features: SnapshotIn<typeof RefNameMap>) {
        self.features = features
      },
    }))
}

export type ApolloViewStateModel = ReturnType<typeof stateModelFactory>
export type ApolloViewModel = Instance<ApolloViewStateModel>
