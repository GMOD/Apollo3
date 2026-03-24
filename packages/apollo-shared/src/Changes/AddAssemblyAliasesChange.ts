import {
  AssemblySpecificChange,
  type Change,
  type ChangeOptions,
  type SerializedAssemblySpecificChange,
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

  getInverse(): Change {
    throw new Error('Method not implemented.')
  }

  toJSON(): SerializedAssemblyAliasesChange {
    const { assembly, aliases, typeName } = this
    return { assembly, typeName, aliases }
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification(): string {
    return 'Assembly aliases have been added.'
  }
}
