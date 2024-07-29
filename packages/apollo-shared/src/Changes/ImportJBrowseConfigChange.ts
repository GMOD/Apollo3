/* eslint-disable @typescript-eslint/require-await */
import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  ServerDataStore,
} from '@apollo-annotation/common'

interface JBrowseAssembly {
  sequence: { adapter: { type: string } }
}

interface JBrowseTrack {
  type: string
  trackId: string
}

interface JBrowsePlugin {
  name: string
}

interface JBrowseInternetAccount {
  type: string
}

export interface JBrowseConfig {
  assemblies?: JBrowseAssembly[]
  tracks?: JBrowseTrack[]
  plugins?: JBrowsePlugin[]
  internetAccounts?: JBrowseInternetAccount[]
  [key: string]: unknown
}

export interface SerializedImportJBrowseConfigChange {
  typeName: 'ImportJBrowseConfigChange'
  oldJBrowseConfig?: JBrowseConfig
  newJBrowseConfig?: JBrowseConfig
}

export function filterJBrowseConfig(config: JBrowseConfig): JBrowseConfig {
  const { assemblies, internetAccounts, plugins, tracks, ...rest } = config
  const filteredAssemblies = assemblies?.filter(
    (a) => a.sequence.adapter.type !== 'ApolloSequenceAdapter',
  )
  const filteredTracks = tracks?.filter((t) => t.type !== 'ApolloTrack')
  const filteredPlugins = plugins?.filter((p) => p.name !== 'Apollo')
  const filteredInternetAccounts = internetAccounts?.filter(
    (i) => i.type !== 'ApolloInternetAccount',
  )
  const filteredConfig = rest as JBrowseConfig
  if (filteredAssemblies) {
    filteredConfig.assemblies = filteredAssemblies
  }
  if (filteredTracks) {
    filteredConfig.tracks = filteredTracks
  }
  if (filteredPlugins) {
    filteredConfig.plugins = filteredPlugins
  }
  if (filteredInternetAccounts) {
    filteredConfig.internetAccounts = filteredInternetAccounts
  }
  return filteredConfig
}

export class ImportJBrowseConfigChange extends Change {
  typeName = 'ImportJBrowseConfigChange' as const
  oldJBrowseConfig?: JBrowseConfig
  newJBrowseConfig?: JBrowseConfig

  constructor(
    json: SerializedImportJBrowseConfigChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.oldJBrowseConfig = json.oldJBrowseConfig
    this.newJBrowseConfig = json.newJBrowseConfig
  }

  toJSON(): SerializedImportJBrowseConfigChange {
    const { newJBrowseConfig, oldJBrowseConfig, typeName } = this
    return { typeName, oldJBrowseConfig, newJBrowseConfig }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { jbrowseConfigModel } = backend
    const { logger, newJBrowseConfig } = this
    await jbrowseConfigModel.deleteMany()
    if (!newJBrowseConfig) {
      return
    }
    const filteredConfig = filterJBrowseConfig(newJBrowseConfig)
    await jbrowseConfigModel.create(filteredConfig)
    logger.debug?.('Stored new JBrowse Config')
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async executeOnClient(_dataStore: ClientDataStore) {}

  getInverse() {
    const { logger, newJBrowseConfig, oldJBrowseConfig } = this
    return new ImportJBrowseConfigChange(
      {
        typeName: 'ImportJBrowseConfigChange',
        oldJBrowseConfig: newJBrowseConfig,
        newJBrowseConfig: oldJBrowseConfig,
      },
      { logger },
    )
  }
}
