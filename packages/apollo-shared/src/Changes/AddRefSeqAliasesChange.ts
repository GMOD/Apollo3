import {
  AssemblySpecificChange,
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from '@apollo-annotation/common'

export interface SerializedRefSeqAliases {
  refName: string
  aliases: string[]
}

export interface SerializedRefSeqAliasesChange extends SerializedChange {
  typeName: string
  assembly: string
  refSeqAliases: SerializedRefSeqAliases[]
}

export class AddRefSeqAliasesChange extends AssemblySpecificChange {
  typeName = 'AddRefSeqAliasesChange'
  assembly: string
  refSeqAliases: SerializedRefSeqAliases[]

  constructor(json: SerializedRefSeqAliasesChange, options?: ChangeOptions) {
    super(json, options)
    this.assembly = json.assembly
    this.refSeqAliases = json.refSeqAliases
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async executeOnClient(_clientDataStore: ClientDataStore) {}

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
        .updateOne(
          { assembly, name: refName },
          { $push: { aliases: { $each: aliases } } },
        )
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
