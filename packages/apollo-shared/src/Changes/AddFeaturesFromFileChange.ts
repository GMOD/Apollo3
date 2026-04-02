import {
  AssemblySpecificChange,
  type ChangeOptions,
  type SerializedAssemblySpecificChange,
} from '@apollo-annotation/common'

export interface SerializedAddFeaturesFromFileChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddFeaturesFromFileChange'
  deleteExistingFeatures?: boolean
}

export interface AddFeaturesFromFileChangeDetails {
  fileId: string
  parseOptions?: { bufferSize?: number; strict?: boolean }
}

export interface SerializedAddFeaturesFromFileChangeSingle
  extends SerializedAddFeaturesFromFileChangeBase,
    AddFeaturesFromFileChangeDetails {}

export interface SerializedAddFeaturesFromFileChangeMultiple
  extends SerializedAddFeaturesFromFileChangeBase {
  changes: AddFeaturesFromFileChangeDetails[]
}

export type SerializedAddFeaturesFromFileChange =
  | SerializedAddFeaturesFromFileChangeSingle
  | SerializedAddFeaturesFromFileChangeMultiple

export class AddFeaturesFromFileChange extends AssemblySpecificChange {
  typeName = 'AddFeaturesFromFileChange' as const
  changes: AddFeaturesFromFileChangeDetails[]
  deleteExistingFeatures = false

  constructor(
    json: SerializedAddFeaturesFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.deleteExistingFeatures = json.deleteExistingFeatures ?? false
    this.changes = 'changes' in json ? json.changes : [json]
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification(): string {
    return 'Features have been added. To see them, please refresh the page.'
  }

  toJSON(): SerializedAddFeaturesFromFileChange {
    const { assembly, changes, deleteExistingFeatures, typeName } = this
    if (changes.length === 1) {
      const [{ fileId }] = changes
      return { typeName, assembly, fileId, deleteExistingFeatures }
    }
    return { typeName, assembly, changes, deleteExistingFeatures }
  }

  getInverse() {
    const { assembly, changes, logger, typeName } = this
    return new AddFeaturesFromFileChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}
