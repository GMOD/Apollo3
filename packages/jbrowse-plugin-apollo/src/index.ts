import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DisplayType,
  InternetAccountType,
  TrackType,
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  AppRootModel,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import {
  CoreValidation,
  ParentChildValidation,
  changeRegistry,
  changes,
  validationRegistry,
} from 'apollo-shared'
import { getRoot } from 'mobx-state-tree'

import { version } from '../package.json'
import {
  configSchema as apolloInternetAccountConfigSchema,
  modelFactory as apolloInternetAccountModelFactory,
} from './ApolloInternetAccount'
import { ApolloInternetAccountModel } from './ApolloInternetAccount/model'
import {
  ApolloRenderer,
  ReactComponent as ApolloRendererReactComponent,
  configSchema as apolloRendererConfigSchema,
} from './ApolloRenderer'
import { installApolloSequenceAdapter } from './ApolloSequenceAdapter'
import { AddAssembly, ImportFeatures, ViewChangeLog } from './components'
import { DownloadGFF3 } from './components/DownloadGFF3'
import {
  stateModelFactory as LinearApolloDisplayStateModelFactory,
  configSchemaFactory as linearApolloDisplayConfigSchemaFactory,
} from './LinearApolloDisplay'
import { makeDisplayComponent } from './makeDisplayComponent'
import { ApolloSessionModel, extendSession } from './session'

Object.entries(changes).forEach(([changeName, change]) => {
  changeRegistry.registerChange(changeName, change)
})

validationRegistry.registerValidation(new CoreValidation())
validationRegistry.registerValidation(new ParentChildValidation())

export default class ApolloPlugin extends Plugin {
  name = 'ApolloPlugin'
  version = version

  install(pluginManager: PluginManager) {
    installApolloSequenceAdapter(pluginManager)
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'ApolloTrack',
        { adapter: '' },
        {
          baseConfiguration: createBaseTrackConfig(pluginManager),
          explicitIdentifier: 'trackId',
        },
      )
      return new TrackType({
        name: 'ApolloTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'ApolloTrack',
          configSchema,
        ),
      })
    })

    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        name: 'ApolloInternetAccount',
        configSchema: apolloInternetAccountConfigSchema,
        stateModel: apolloInternetAccountModelFactory(
          apolloInternetAccountConfigSchema,
          pluginManager,
        ),
      })
    })

    pluginManager.addDisplayType(() => {
      const configSchema = linearApolloDisplayConfigSchemaFactory(pluginManager)
      const DisplayComponent = makeDisplayComponent(pluginManager)
      return new DisplayType({
        name: 'LinearApolloDisplay',
        configSchema,
        stateModel: LinearApolloDisplayStateModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'ApolloTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: DisplayComponent,
      })
    })

    pluginManager.addRendererType(
      () =>
        new ApolloRenderer({
          name: 'ApolloRenderer',
          ReactComponent: ApolloRendererReactComponent,
          configSchema: apolloRendererConfigSchema,
          pluginManager,
        }),
    )

    pluginManager.addToExtensionPoint('Core-extendSession', extendSession)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.insertMenu('Apollo', -1)
      console.log('Create menu item "Add Assembly"')
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Add Assembly',
        onClick: (session: AbstractSessionModel) => {
          const { internetAccounts } = getRoot(session) as AppRootModel
          const apolloInternetAccount = internetAccounts.find(
            (ia) => ia.type === 'ApolloInternetAccount',
          ) as ApolloInternetAccountModel | undefined
          if (!apolloInternetAccount) {
            throw new Error('No Apollo internet account found')
          }
          if (!apolloInternetAccount.role.includes('admin')) {
            const { notify } = session
            notify(`No rights to add new assembly`, 'error')
            return
          }
          session.queueDialog((doneCallback) => [
            AddAssembly,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
              changeManager: (session as ApolloSessionModel).apolloDataStore
                .changeManager,
            },
          ])
        },
      })
      // pluginManager.rootModel.appendToMenu('Apollo', {
      //   label: 'Add Assembly',
      //   onClick: (session: AbstractSessionModel) => {
      //     session.queueDialog((doneCallback) => [
      //       AddAssembly,
      //       {
      //         session,
      //         handleClose: () => {
      //           doneCallback()
      //         },
      //         changeManager: (session as ApolloSessionModel).apolloDataStore
      //           .changeManager,
      //       },
      //     ])
      //   },
      // })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Import Features',
        onClick: (session: AbstractSessionModel) => {
          session.queueDialog((doneCallback) => [
            ImportFeatures,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
              changeManager: (session as ApolloSessionModel).apolloDataStore
                .changeManager,
            },
          ])
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Download GFF3',
        onClick: (session: AbstractSessionModel) => {
          session.queueDialog((doneCallback) => [
            DownloadGFF3,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
            },
          ])
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'View Change Log',
        onClick: (session: AbstractSessionModel) => {
          session.queueDialog((doneCallback) => [
            ViewChangeLog,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
            },
          ])
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Undo',
        onClick: (session: ApolloSessionModel) => {
          const { apolloDataStore, notify } = session
          if (apolloDataStore.changeManager.recentChanges.length) {
            apolloDataStore.changeManager.revertLastChange()
          } else {
            notify('No changes to undo', 'info')
          }
        },
      })
    }
  }
}
