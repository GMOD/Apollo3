import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AdapterClass as ApolloAdapterClass,
  configSchema as apolloAdapterConfigSchema,
} from './ApolloAdapter'
import {
  AdapterClass as ApolloSequenceAdapterClass,
  configSchema as apolloSequenceAdapterConfigSchema,
} from './ApolloSequenceAdapter'
import LinearApolloDisplay from './LinearApolloDisplay'
import ApolloConnection from './ApolloConnection'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { SvgFeatureRendererReactComponent } from '@jbrowse/plugin-svg'
import {
  configSchema as apolloRendererConfigSchema,
  RendererType as ApolloRendererType,
} from './ApolloRenderer'
import LinearApolloReferenceSequenceDisplay from './LinearApolloReferenceSequenceDisplay'
// import { ApolloSetCredentials } from './ApolloRPC'

export default class ApolloPlugin extends Plugin {
  name = 'Apollo'

  install(pluginManager: PluginManager) {
    const LGVPlugin = pluginManager.getPlugin(
      'LinearGenomeViewPlugin',
    ) as import('@jbrowse/plugin-linear-genome-view').default
    const { BaseLinearDisplayComponent } = LGVPlugin.exports

    pluginManager.addConnectionType(() => {
      const { configSchema, stateModel, getAssemblies } = pluginManager.load(
        ApolloConnection,
      )
      return new ConnectionType({
        name: 'ApolloConnection',
        configSchema,
        stateModel,
        getAssemblies,
        displayName: 'Apollo',
        description: 'An Apollo annotation server',
        url: '//genomearchitect.readthedocs.io/en/latest/UsersGuide.html',
      })
    })

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'ApolloAdapter',
          configSchema: apolloAdapterConfigSchema,
          AdapterClass: ApolloAdapterClass,
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'ApolloSequenceAdapter',
          configSchema: apolloSequenceAdapterConfigSchema,
          AdapterClass: ApolloSequenceAdapterClass,
        }),
    )

    pluginManager.addRendererType(
      () =>
        new ApolloRendererType({
          name: 'ApolloRenderer',
          ReactComponent: SvgFeatureRendererReactComponent,
          configSchema: apolloRendererConfigSchema,
        }),
    )

    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'ApolloTrack',
        {},
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

    pluginManager.addDisplayType(() => {
      const { configSchema, stateModel } = pluginManager.load(
        LinearApolloDisplay,
      )
      return new DisplayType({
        name: 'LinearApolloDisplay',
        configSchema,
        stateModel,
        trackType: 'ApolloTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })

    pluginManager.addDisplayType(() => {
      const { stateModel, configSchema } = pluginManager.load(
        LinearApolloReferenceSequenceDisplay,
      )
      return {
        name: 'LinearApolloReferenceSequenceDisplay',
        configSchema,
        stateModel,
        trackType: 'ReferenceSequenceTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      }
    })
  }

  configure(pluginManager: PluginManager) {
    const refSeqTrackDisplayTypes =
      pluginManager.trackTypes.registeredTypes.ReferenceSequenceTrack
        .displayTypes
    const apolloDisplayIdx = refSeqTrackDisplayTypes.findIndex(
      displayType =>
        displayType.name === 'LinearApolloReferenceSequenceDisplay',
    )
    refSeqTrackDisplayTypes.splice(
      0,
      0,
      refSeqTrackDisplayTypes.splice(apolloDisplayIdx, 1)[0],
    )
    // @ts-ignore
    pluginManager.rootModel?.jbrowse.addConnectionConf({
      type: 'ApolloConnection',
      connectionId: 'ApolloConnection-1610659009682',
      name: 'Apollo Demo Instance',
      ephemeral: true,
    })
    // const appRoot = document.getElementById('root')
    // const modal = document.createElement('div')
    // modal.setAttribute('id', 'modal-root')
    // appRoot?.parentElement?.appendChild(modal)
    // const React = pluginManager.jbrequire('react')
    // const ReactDOM = pluginManager.jbrequire('react-dom')
    // console.log('here', modal)
    // ReactDOM.createPortal(<div>this is a portal</div>, modal)
  }
}
