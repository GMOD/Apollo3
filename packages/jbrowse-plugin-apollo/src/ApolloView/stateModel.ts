import { GFF3Item } from '@gmod/gff'
import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import { Instance, types } from 'mobx-state-tree'

export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model({
      type: types.literal('ApolloView'),
      linearGenomeView: pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel,
      gff3Data: types.frozen(),
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
      setGFF3Data(data: GFF3Item[]) {
        self.gff3Data = data
      },
    }))
}

export type ApolloViewStateModel = ReturnType<typeof stateModelFactory>
export type ApolloViewModel = Instance<ApolloViewStateModel>
