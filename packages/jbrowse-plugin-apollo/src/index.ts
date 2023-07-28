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
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import { changeRegistry } from 'apollo-common'
import {
  CoreValidation,
  ParentChildValidation,
  changes,
  validationRegistry,
} from 'apollo-shared'

import { version } from '../package.json'
import {
  configSchema as apolloInternetAccountConfigSchema,
  modelFactory as apolloInternetAccountModelFactory,
} from './ApolloInternetAccount'
import { installApolloSequenceAdapter } from './ApolloSequenceAdapter'
import {
  ApolloSixFrameRenderer,
  ReactComponent as ApolloSixFrameRendererReactComponent,
  configSchema as apolloSixFrameRendererConfigSchema,
} from './ApolloSixFrameRenderer'
import { installApolloTextSearchAdapter } from './ApolloTextSearchAdapter'
import { DownloadGFF3, OpenLocalFile, ViewChangeLog } from './components'
import ApolloPluginConfigurationSchema from './config'
import {
  stateModelFactory as LinearApolloDisplayStateModelFactory,
  configSchemaFactory as linearApolloDisplayConfigSchemaFactory,
} from './LinearApolloDisplay'
import {
  DisplayComponent,
  makeSixFrameDisplayComponent,
} from './makeDisplayComponent'
import { ApolloSessionModel, extendSession } from './session'
import {
  stateModelFactory as SixFrameFeatureDisplayStateModelFactory,
  configSchemaFactory as sixFrameFeatureDisplayConfigSchemaFactory,
} from './SixFrameFeatureDisplay'

Object.entries(changes).forEach(([changeName, change]) => {
  changeRegistry.registerChange(changeName, change)
})

validationRegistry.registerValidation(new CoreValidation())
validationRegistry.registerValidation(new ParentChildValidation())

export default class ApolloPlugin extends Plugin {
  name = 'ApolloPlugin'
  version = version
  configurationSchema = ApolloPluginConfigurationSchema

  install(pluginManager: PluginManager) {
    installApolloSequenceAdapter(pluginManager)
    installApolloTextSearchAdapter(pluginManager)
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

    pluginManager.addDisplayType(() => {
      const configSchema =
        sixFrameFeatureDisplayConfigSchemaFactory(pluginManager)
      const SixFrameDisplayComponent =
        makeSixFrameDisplayComponent(pluginManager)
      return new DisplayType({
        name: 'SixFrameFeatureDisplay',
        configSchema,
        stateModel: SixFrameFeatureDisplayStateModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'ApolloTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: SixFrameDisplayComponent,
      })
    })

    pluginManager.addRendererType(
      () =>
        new ApolloSixFrameRenderer({
          name: 'ApolloSixFrameRenderer',
          ReactComponent: ApolloSixFrameRendererReactComponent,
          configSchema: apolloSixFrameRendererConfigSchema,
          pluginManager,
        }),
    )

    pluginManager.addToExtensionPoint(
      'Core-extendSession',
      extendSession.bind(this, pluginManager),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.insertMenu('Apollo', -1)
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
        label: 'Open local GFF3 file',
        onClick: (session: AbstractSessionModel) => {
          session.queueDialog((doneCallback) => [
            OpenLocalFile,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
              inMemoryFileDriver: (session as ApolloSessionModel)
                .apolloDataStore.inMemoryFileDriver,
            },
          ])
        },
      })
    }
  }
}
