import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import { Instance, types } from 'mobx-state-tree'

export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model({
      type: types.literal('ApolloView'),
      linearGenomeView: pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel,
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
    }))
}

export type ApolloViewStateModel = ReturnType<typeof stateModelFactory>
export type ApolloViewModel = Instance<ApolloViewStateModel>
