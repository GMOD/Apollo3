import {
  AssemblySpecificChange,
  type ChangeOptions,
  type SerializedAssemblySpecificChange,
} from '@apollo-annotation/common'

export interface SerializedAddAssemblyFromExternalChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddAssemblyFromExternalChange'
}

export interface AddAssemblyFromExternalChangeDetails {
  assemblyName: string
  externalLocation: { fa: string; fai: string; gzi?: string }
}

export interface SerializedAddAssemblyFromExternalChangeSingle
  extends SerializedAddAssemblyFromExternalChangeBase,
    AddAssemblyFromExternalChangeDetails {}

export interface SerializedAddAssemblyFromExternalChangeMultiple
  extends SerializedAddAssemblyFromExternalChangeBase {
  changes: AddAssemblyFromExternalChangeDetails[]
}

export type SerializedAddAssemblyFromExternalChange =
  | SerializedAddAssemblyFromExternalChangeSingle
  | SerializedAddAssemblyFromExternalChangeMultiple

export class AddAssemblyFromExternalChange extends AssemblySpecificChange {
  typeName = 'AddAssemblyFromExternalChange' as const
  changes: AddAssemblyFromExternalChangeDetails[]

  constructor(
    json: SerializedAddAssemblyFromExternalChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  get notification(): string {
    return `Assembly "${this.changes[0].assemblyName}" added successfully. To use it, please refresh the page.`
  }

  toJSON(): SerializedAddAssemblyFromExternalChange {
    const { assembly, changes, typeName } = this
    if (changes.length === 1) {
      const [{ assemblyName, externalLocation }] = changes
      return { typeName, assembly, assemblyName, externalLocation }
    }
    return { typeName, assembly, changes }
  }

  getInverse() {
    const { assembly, changes, logger, typeName } = this
    return new AddAssemblyFromExternalChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}
