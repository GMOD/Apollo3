import {
  AssemblySpecificChange,
  type Change,
  type ChangeOptions,
  type SerializedAssemblySpecificChange,
} from '@apollo-annotation/common'

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

  getInverse(): Change {
    throw new Error('Method not implemented.')
  }

  toJSON(): SerializedRefSeqAliasesChange {
    const { assembly, refSeqAliases, typeName } = this
    return { assembly, typeName, refSeqAliases }
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification(): string {
    return 'RefSeq aliases have been added.'
  }
}
