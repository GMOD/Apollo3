import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DisplayType,
  InternetAccountType,
  PluggableElementType,
  TrackType,
  ViewType,
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  Region,
  getSession,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import AddIcon from '@mui/icons-material/Add'
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
import { BackendDriver } from './BackendDrivers'
import {
  DownloadGFF3,
  ManageChecks,
  OpenLocalFile,
  ViewChangeLog,
} from './components'
import { AddFeature } from './components/AddFeature'
import { ViewCheckResults } from './components/ViewCheckResults'
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

interface RpcHandle {
  on(event: string, listener: (event: MessageEvent) => void): this
  workers: Worker[]
}

interface ApolloMessageData {
  apollo: true
  messageId: string
  method: string
  region: Region
  sequence: string
  assembly: string
}

function isApolloMessageData(data?: unknown): data is ApolloMessageData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'apollo' in data &&
    data.apollo === true
  )
}

const inWebWorker = 'WorkerGlobalScope' in globalThis

for (const [changeName, change] of Object.entries(changes)) {
  changeRegistry.registerChange(changeName, change)
}

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

    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement: PluggableElementType) => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const { stateModel } = pluggableElement as ViewType
          const lgv = stateModel as LinearGenomeViewStateModel
          const newStateModel = lgv.views((self) => {
            const superRubberBandMenuItems = self.rubberBandMenuItems
            return {
              rubberBandMenuItems() {
                return [
                  ...superRubberBandMenuItems(),
                  {
                    label: 'Add new feature',
                    icon: AddIcon,
                    onClick: () => {
                      const session = getSession(
                        self,
                      ) as unknown as ApolloSessionModel
                      const { leftOffset, rightOffset } = self
                      const selectedRegions = self.getSelectedRegions(
                        leftOffset,
                        rightOffset,
                      )
                      ;(session as unknown as AbstractSessionModel).queueDialog(
                        (doneCallback) => [
                          AddFeature,
                          {
                            session,
                            handleClose: () => {
                              doneCallback()
                            },
                            region: selectedRegions[0],
                            changeManager:
                              session.apolloDataStore.changeManager,
                          },
                        ],
                      )
                    },
                  },
                ]
              },
            }
          })

          ;(pluggableElement as ViewType).stateModel = newStateModel
        }
        return pluggableElement
      },
    )
    if (!inWebWorker) {
      pluginManager.addToExtensionPoint(
        'Core-extendWorker',
        (handle: RpcHandle) => {
          if (!('on' in handle && handle.on)) {
            return handle
          }
          handle.on('apollo', async (event: MessageEvent) => {
            if (!isApolloMessageData(event)) {
              return
            }
            const { apollo, messageId, method } = event
            switch (method) {
              case 'getSequence': {
                const { region } = event
                const { assemblyName } = region
                const dataStore = (
                  pluginManager.rootModel?.session as
                    | ApolloSessionModel
                    | undefined
                )?.apolloDataStore
                if (!dataStore) {
                  break
                }
                const backendDriver = dataStore.getBackendDriver(
                  assemblyName,
                ) as BackendDriver
                const { seq: sequence } =
                  await backendDriver.getSequence(region)
                handle.workers[0].postMessage({
                  apollo,
                  messageId,
                  sequence,
                })
                break
              }
              case 'getRegions': {
                const { assembly } = event
                const dataStore = (
                  pluginManager.rootModel?.session as
                    | ApolloSessionModel
                    | undefined
                )?.apolloDataStore
                if (!dataStore) {
                  break
                }
                const backendDriver = dataStore.getBackendDriver(
                  assembly,
                ) as BackendDriver
                const regions = await backendDriver.getRegions(assembly)
                handle.workers[0].postMessage({
                  apollo,
                  messageId,
                  regions,
                })
                break
              }
              default: {
                break
              }
            }
          })
          return handle
        },
      )
    }
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.insertMenu('Apollo', -1)
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Download GFF3',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              DownloadGFF3,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
              },
            ],
          )
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Manage Checks',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              ManageChecks,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
              },
            ],
          )
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'View Change Log',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              ViewChangeLog,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
              },
            ],
          )
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Open local GFF3 file',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              OpenLocalFile,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
                inMemoryFileDriver: session.apolloDataStore.inMemoryFileDriver,
              },
            ],
          )
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'View check results',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              ViewCheckResults,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
              },
            ],
          )
        },
      })
    }
  }
}
