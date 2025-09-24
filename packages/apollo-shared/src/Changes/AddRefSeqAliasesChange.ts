import {
  AssemblySpecificChange,
  type Change,
  type ChangeOptions,
  type ClientDataStore,
  type LocalGFF3DataStore,
  type SerializedAssemblySpecificChange,
  type ServerDataStore,
} from '@apollo-annotation/common'
import { getSession } from '@jbrowse/core/util'

export interface SerializedRefSeqAliases {
  refName: string
  aliases: string[]
}

export interface SerializedRefSeqAliasesChange
  extends SerializedAssemblySpecificChange {
  typeName: 'AddRefSeqAliasesChange'
  refSeqAliases: SerializedRefSeqAliases[]
}

export class AddRefSeqAliasesChange extends AssemblySpecificChange {
  typeName = 'AddRefSeqAliasesChange' as const
  refSeqAliases: SerializedRefSeqAliases[]

  constructor(json: SerializedRefSeqAliasesChange, options?: ChangeOptions) {
    super(json, options)
    this.refSeqAliases = json.refSeqAliases
  }

  executeOnClient(clientDataStore: ClientDataStore) {
    const { assemblyManager } = getSession(clientDataStore)
    const assembly = assemblyManager.get(this.assembly)
    if (!assembly) {
      throw new Error(`assembly ${this.assembly} not found`)
    }
    const sessionAliases = assembly.refNameAliases ?? {}

    for (const refSeqAlias of this.refSeqAliases) {
      const { aliases, refName } = refSeqAlias
      for (const alias of aliases) {
        if (alias in sessionAliases) {
          continue
        }
        sessionAliases[alias] = refName
      }
    }
    assembly.setRefNameAliases(sessionAliases)
    return Promise.resolve()
  }

  getInverse(): Change {
    throw new Error('Method not implemented.')
  }

  toJSON(): SerializedRefSeqAliasesChange {
    const { assembly, refSeqAliases, typeName } = this
    return { assembly, typeName, refSeqAliases }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { refSeqModel, session } = backend
    const { assembly, logger, refSeqAliases } = this

    for (const refSeqAlias of refSeqAliases) {
      logger.debug?.(
        `Updating Refname alias for assembly: ${assembly}, refSeqAlias: ${JSON.stringify(refSeqAlias)}`,
      )
      const { aliases, refName } = refSeqAlias
      await refSeqModel
        .updateOne({ assembly, name: refName }, { $set: { aliases } })
        .session(session)
    }
  }

  executeOnLocalGFF3(_backend: LocalGFF3DataStore): Promise<unknown> {
    throw new Error('Method not implemented.')
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification(): string {
    return 'RefSeq aliases have been added.'
  }
}
