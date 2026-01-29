/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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

  executeOnClient(clientDataStore: ClientDataStore) {
    const { assemblyManager } = getSession(clientDataStore)
    const assembly = assemblyManager.get(this.assembly)
    if (!assembly) {
      throw new Error(`assembly ${this.assembly} not found`)
    }
    assembly.configuration.aliases.set(this.aliases)
    return Promise.resolve()
  }

  getInverse(): Change {
    throw new Error('Method not implemented.')
  }

  toJSON(): SerializedAssemblyAliasesChange {
    const { assembly, aliases, typeName } = this
    return { assembly, typeName, aliases }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { assemblyModel } = backend
    const { assembly, logger, aliases } = this
    logger.debug?.(
      `Updating assembly aliases for assembly: ${assembly}, aliases: ${JSON.stringify(aliases)}`,
    )
    const asm = await assemblyModel.findById(assembly)
    if (!asm) {
      throw new Error(`Assembly with ID ${assembly} not found`)
    }
    asm.aliases = aliases
    await asm.save()
  }

  executeOnLocalGFF3(_backend: LocalGFF3DataStore): Promise<unknown> {
    throw new Error('Method not implemented.')
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification(): string {
    return 'Assembly aliases have been added.'
  }
}
