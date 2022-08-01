import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DisplayType,
  InternetAccountType,
  TrackType,
  ViewType,
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
  AddAssemblyFromFileChange,
  AddFeaturesFromFileChange,
  CopyFeatureChange,
  LocationEndChange,
  LocationStartChange,
  TypeChange,
  changeRegistry,
} from 'apollo-shared'
import { IAnyModelType, flow, getRoot } from 'mobx-state-tree'

import { version } from '../package.json'
import {
  ApolloDetailsView as ApolloDetailsViewReactComponent,
  stateModelFactory as apolloDetailsViewStateModelFactory,
} from './ApolloDetailsView'
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
import {
  ApolloView as ApolloViewReactComponent,
  stateModelFactory as apolloViewStateModelFactory,
} from './ApolloView'
import { AddAssembly, ImportFeatures, ViewChangeLog } from './components'
import {
  stateModelFactory as LinearApolloDisplayStateModelFactory,
  configSchemaFactory as linearApolloDisplayConfigSchemaFactory,
} from './LinearApolloDisplay'
import { makeDisplayComponent } from './makeDisplayComponent'

interface ApolloAssembly {
  _id: string
  name: string
  displayName?: string
  description?: string
  aliases?: string[]
}

interface ApolloRefSeq {
  _id: string
  name: string
  description?: string
  length: string
  assembly: string
}

changeRegistry.registerChange(
  'AddAssemblyFromFileChange',
  AddAssemblyFromFileChange,
)
changeRegistry.registerChange(
  'AddFeaturesFromFileChange',
  AddFeaturesFromFileChange,
)
changeRegistry.registerChange('CopyFeatureChange', CopyFeatureChange)
changeRegistry.registerChange('LocationEndChange', LocationEndChange)
changeRegistry.registerChange('LocationStartChange', LocationStartChange)
changeRegistry.registerChange('TypeChange', TypeChange)

export default class ApolloPlugin extends Plugin {
  name = 'ApolloPlugin'
  version = version

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'ApolloDetailsView',
        stateModel: apolloDetailsViewStateModelFactory(pluginManager),
        ReactComponent: ApolloDetailsViewReactComponent,
      })
    })

    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'ApolloView',
        stateModel: apolloViewStateModelFactory(pluginManager),
        ReactComponent: ApolloViewReactComponent,
      })
    })

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

    pluginManager.addToExtensionPoint('Core-extendSession', (sessionModel) => {
      return (sessionModel as IAnyModelType).extend((self) => {
        const aborter = new AbortController()
        const { signal } = aborter
        return {
          actions: {
            afterCreate: flow(function* afterCreate() {
              const { internetAccounts } = getRoot(self) as AppRootModel
              for (const internetAccount of internetAccounts as ApolloInternetAccountModel[]) {
                const { baseURL } = internetAccount
                const uri = new URL('assemblies', baseURL).href
                const fetch = internetAccount.getFetcher({
                  locationType: 'UriLocation',
                  uri,
                })
                let response: Response
                try {
                  // @ts-ignore
                  response = yield fetch(uri, { signal })
                } catch (e) {
                  console.error('error here')
                  console.error(e)
                  // setError(e instanceof Error ? e : new Error(String(e)))
                  return
                }
                if (!response.ok) {
                  let errorMessage
                  try {
                    errorMessage = yield response.text()
                  } catch (e) {
                    errorMessage = ''
                  }
                  console.error('error here 2')
                  console.error(
                    `Failed to fetch assemblies — ${response.status} (${
                      response.statusText
                    })${errorMessage ? ` (${errorMessage})` : ''}`,
                  )

                  // setError(
                  //   new Error(
                  //     `Failed to fetch assemblies — ${response.status} (${
                  //       response.statusText
                  //     })${errorMessage ? ` (${errorMessage})` : ''}`,
                  //   ),
                  // )
                  return
                }
                let fetchedAssemblies
                try {
                  fetchedAssemblies =
                    (yield response.json()) as unknown as ApolloAssembly[]
                } catch (e) {
                  console.error('error here 3')
                  console.error(e)
                  // setError(e instanceof Error ? e : new Error(String(e)))
                  return
                }
                for (const assembly of fetchedAssemblies) {
                  const { assemblyManager } = self
                  const selectedAssembly = assemblyManager.get(assembly.name)
                  if (selectedAssembly) {
                    return
                  }
                  const searchParams = new URLSearchParams({
                    assembly: assembly._id,
                  })
                  const uri2 = new URL(
                    `refSeqs?${searchParams.toString()}`,
                    baseURL,
                  ).href
                  const fetch2 = internetAccount.getFetcher({
                    locationType: 'UriLocation',
                    uri: uri2,
                  })
                  const response2 = (yield fetch2(uri2, {
                    signal,
                  })) as unknown as Response
                  if (!response.ok) {
                    let errorMessage
                    try {
                      errorMessage = yield response.text()
                    } catch (e) {
                      errorMessage = ''
                    }
                    throw new Error(
                      `Failed to fetch fasta info — ${response.status} (${
                        response.statusText
                      })${errorMessage ? ` (${errorMessage})` : ''}`,
                    )
                  }
                  const f =
                    (yield response2.json()) as unknown as ApolloRefSeq[]
                  const features = f.map((contig) => ({
                    refName: contig.name,
                    uniqueId: contig._id,
                    start: 0,
                    end: contig.length,
                  }))
                  const assemblyConfig = {
                    name: assembly._id,
                    aliases: [assembly.name, ...(assembly.aliases || [])],
                    displayName: assembly.displayName || assembly.name,
                    sequence: {
                      trackId: `sequenceConfigId-${assembly.name}`,
                      type: 'ReferenceSequenceTrack',
                      adapter: {
                        type: 'FromConfigRegionsAdapter',
                        features,
                      },
                    },
                  }
                  self.addAssembly(assemblyConfig)
                }
              }
            }),
            beforeDestroy() {
              aborter.abort()
            },
          },
        }
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.insertMenu('Apollo', -1)
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Add Apollo View',
        onClick: (session: AbstractSessionModel) => {
          session.addView('ApolloView', {})
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Add Assembly',
        onClick: (session: AbstractSessionModel) => {
          session.queueDialog((doneCallback) => [
            AddAssembly,
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
        label: 'Import Features',
        onClick: (session: AbstractSessionModel) => {
          session.queueDialog((doneCallback) => [
            ImportFeatures,
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
    }
  }
}
