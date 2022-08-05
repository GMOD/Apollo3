import { getConf } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import { AppRootModel } from '@jbrowse/core/util'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import {
  AnnotationFeatureLocation,
  AnnotationFeatureLocationI,
  FeaturesForRefName,
} from 'apollo-mst'
import {
  ChangeManager,
  CollaborationServerDriver,
  CoreValidation,
  ValidationSet,
} from 'apollo-shared'
import {
  Instance,
  SnapshotIn,
  cast,
  getRoot,
  resolveIdentifier,
  types,
} from 'mobx-state-tree'

import { ApolloDetailsViewStateModel } from '../ApolloDetailsView/stateModel'
import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

export const ClientDataStore = types
  .model('ClientDataStore', {
    typeName: types.literal('Client'),
    features: FeaturesForRefName,
    backendDriverType: types.maybe(
      types.enumeration('backendDriverType', ['CollaborationServerDriver']),
    ),
    internetAccountConfigId: types.maybe(types.string),
    assemblyId: types.string,
  })
  .views((self) => ({
    get internetAccounts() {
      return (getRoot(self) as AppRootModel).internetAccounts
    },
  }))
  .actions((self) => ({
    load(features: SnapshotIn<typeof FeaturesForRefName>) {
      self.features = cast(features)
    },
    getFeature(featureId: string) {
      return resolveIdentifier(
        AnnotationFeatureLocation,
        self.features,
        featureId,
      )
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
    changeManager: new ChangeManager(
      self,
      new ValidationSet([new CoreValidation()]),
    ),
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
      apolloDetailsView: types.optional(
        pluginManager.getViewType('ApolloDetailsView')
          .stateModel as ApolloDetailsViewStateModel,
        { type: 'ApolloDetailsView' },
      ),
      selectedFeature: types.maybe(types.reference(AnnotationFeatureLocation)),
      dataStore: types.maybe(ClientDataStore),
      displayName: 'Apollo',
    })
    .views((self) => ({
      get width() {
        return self.linearGenomeView.width
      },
      menuItems(): MenuItem[] {
        let undoDisabled = true
        if (self.dataStore) {
          const { changeManager } = self.dataStore
          if (changeManager.recentChanges.length) {
            undoDisabled = false
          }
        }
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
              const searchParams = new URLSearchParams({
                assembly: self.dataStore?.assemblyId || '',
              })
              const uri = new URL(
                `features/exportGFF3?${searchParams.toString()}`,
                internetAccount.baseURL,
              ).href
              window.open(uri, '_blank')
            },
          },
          {
            label: 'Undo',
            onClick: () => {
              self.dataStore?.changeManager.revertLastChange()
            },
            disabled: undoDisabled,
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
      setSelectedFeature(feature?: AnnotationFeatureLocationI) {
        self.selectedFeature = feature
      },
    }))
}

export type ApolloViewStateModel = ReturnType<typeof stateModelFactory>
export type ApolloViewModel = Instance<ApolloViewStateModel>
