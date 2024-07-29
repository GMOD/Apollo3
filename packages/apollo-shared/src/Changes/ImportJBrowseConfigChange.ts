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
    const { logger, newJBrowseConfig: newJBrowseConfig } = this
    await jbrowseConfigModel.deleteMany()
    if (!newJBrowseConfig) {
      return
    }

    const filteredAssemblies = newJBrowseConfig.assemblies?.map(
      (a) => a.sequence.adapter.type !== 'ApolloSequenceAdapter`',
    )
    const filteredTracks = newJBrowseConfig.tracks?.map(
      (t) => t.type !== 'ApolloTrack',
    )
    const filteredPlugins = newJBrowseConfig.plugins?.map(
      (p) => p.name !== 'Apollo',
    )
    const filteredInternetAccounts = newJBrowseConfig.internetAccounts?.map(
      (i) => i.type !== 'ApolloInternetAccount',
    )
    await jbrowseConfigModel.create({
      ...newJBrowseConfig,
      assemblies: filteredAssemblies,
      tracks: filteredTracks,
      plugins: filteredPlugins,
      internetAccounts: filteredInternetAccounts,
    })
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
