import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import {
  ChangeManager,
  CollaborationServerDriver,
  FeaturesForRefName,
  ValidationSet,
} from 'apollo-shared'
import { Instance, SnapshotIn, cast, types } from 'mobx-state-tree'

export const ClientDataStore = types
  .model('ClientDataStore', {
    typeName: types.literal('Client'),
    features: FeaturesForRefName,
    backendDriverType: types.maybe(
      types.enumeration('backendDriverType', ['CollaborationServerDriver']),
    ),
  })
  .actions((self) => ({
    load(features: SnapshotIn<typeof FeaturesForRefName>) {
      self.features = cast(features)
    },
  }))
  .volatile((self) => {
    if (self.backendDriverType !== 'CollaborationServerDriver') {
      throw new Error(`Unknown backend driver type "${self.backendDriverType}"`)
    }
    return {
      backendDriver: new CollaborationServerDriver(self),
    }
  })
  .volatile((self) => ({
    changeManager: new ChangeManager(self, new ValidationSet([])),
  }))

export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('ApolloView', {
      type: types.literal('ApolloView'),
      linearGenomeView: types.optional(
        pluginManager.getViewType('LinearGenomeView')
          .stateModel as LinearGenomeViewStateModel,
        { type: 'LinearGenomeView' },
      ),
      dataStore: types.maybe(ClientDataStore),
      displayName: 'Apollo',
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
      setDataStore(dataStore: SnapshotIn<typeof ClientDataStore>) {
        self.dataStore = cast(dataStore)
        return self.dataStore
      },
      setDisplayName(displayName: string) {
        self.displayName = displayName
      },
    }))
}

export type ApolloViewStateModel = ReturnType<typeof stateModelFactory>
export type ApolloViewModel = Instance<ApolloViewStateModel>
