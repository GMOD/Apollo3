import { getConf } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import { AppRootModel } from '@jbrowse/core/util'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import {
  ChangeManager,
  CollaborationServerDriver,
  FeaturesForRefName,
  ValidationSet,
} from 'apollo-shared'
import { saveAs } from 'file-saver'
import { Instance, SnapshotIn, cast, getRoot, types } from 'mobx-state-tree'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

export const ClientDataStore = types
  .model('ClientDataStore', {
    typeName: types.literal('Client'),
    features: FeaturesForRefName,
    backendDriverType: types.maybe(
      types.enumeration('backendDriverType', ['CollaborationServerDriver']),
    ),
    internetAccountConfigId: types.maybe(types.string),
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
      menuItems(): MenuItem[] {
        return [
          {
            label: 'Download GFF3',
            onClick: async () => {
              const internetAccountConfigId =
                self.dataStore?.internetAccountConfigId
              const { internetAccounts } = getRoot(self) as AppRootModel
              const internetAccount = internetAccounts.find(
                (ia) =>
                  getConf(ia, 'internetAccountId') === internetAccountConfigId,
              ) as ApolloInternetAccountModel | undefined
              if (!internetAccount) {
                throw new Error(
                  `No InternetAccount found with config id ${internetAccountConfigId}`,
                )
              }
              const url = new URL(
                'filehandling/downloadcache',
                internetAccount.baseURL,
              )
              const fetch = internetAccount.getFetcher({
                locationType: 'UriLocation',
                uri: url.toString(),
              })
              const responses = await fetch(url.toString(), {
                headers: { 'Content-Type': 'application/txt' },
              })
              const blob = await responses.blob()
              saveAs(blob, 'Apollo_download.gff3')
            },
          },
        ]
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
