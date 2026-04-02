import {
  AssemblySpecificChange,
  type SerializedAssemblySpecificChange,
} from '@apollo-annotation/common'

export interface SerializedDeleteAssemblyChange
  extends SerializedAssemblySpecificChange {
  typeName: 'DeleteAssemblyChange'
}
export class DeleteAssemblyChange extends AssemblySpecificChange {
  typeName = 'DeleteAssemblyChange' as const

  get notification(): string {
    return `Assembly "${this.assembly}" deleted successfully.`
  }

  toJSON(): SerializedDeleteAssemblyChange {
    const { assembly, typeName } = this
    return { typeName, assembly }
  }

  getInverse() {
    const { assembly, logger } = this
    return new DeleteAssemblyChange(
      { typeName: 'DeleteAssemblyChange', assembly },
      { logger },
    )
  }
}
