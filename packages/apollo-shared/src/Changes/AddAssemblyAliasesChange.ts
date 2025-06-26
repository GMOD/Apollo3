import {
  AssemblySpecificChange,
  type Change,
  type ChangeOptions,
  type ClientDataStore,
  type LocalGFF3DataStore,
  type SerializedAssemblySpecificChange,
  type ServerDataStore,
} from '@apollo-annotation/common'

export interface SerializedAssemblyAliasesChange
  extends SerializedAssemblySpecificChange {
  typeName: 'AddAssemblyAliasesChange'
  aliases: string[]
}

export class AddAssemblyAliasesChange extends AssemblySpecificChange {
  typeName = 'AddAssemblyAliasesChange' as const
  aliases: string[]

  constructor(json: SerializedAssemblyAliasesChange, options?: ChangeOptions) {
    super(json, options)
    this.aliases = json.aliases
  }

  executeOnClient(_clientDataStore: ClientDataStore): Promise<void> {
    throw new Error('Method not implemented.')
  }

  getInverse(): Change {
    throw new Error('Method not implemented.')
  }

  toJSON(): SerializedAssemblyAliasesChange {
    const { assembly, aliases, typeName } = this
    return { assembly, typeName, aliases }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { assemblyModel, session } = backend
    const { assembly, logger, aliases } = this

    logger.debug?.(
      `Updating assembly aliases for assembly: ${assembly}, aliases: ${JSON.stringify(aliases)}`,
    )
    await assemblyModel
      .updateOne({ name: assembly }, { $set: { aliases } })
      .session(session)
  }

  executeOnLocalGFF3(_backend: LocalGFF3DataStore): Promise<unknown> {
    throw new Error('Method not implemented.')
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification(): string {
    return 'Assembly aliases have been added.'
  }
}
