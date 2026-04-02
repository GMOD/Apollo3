import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'

interface SerializedTypeChangeBase extends SerializedFeatureChange {
  typeName: 'TypeChange'
}

interface TypeChangeDetails {
  featureId: string
  oldType: string
  newType: string
}

interface SerializedTypeChangeSingle
  extends SerializedTypeChangeBase,
    TypeChangeDetails {}

interface SerializedTypeChangeMultiple extends SerializedTypeChangeBase {
  changes: TypeChangeDetails[]
}

export type SerializedTypeChange =
  | SerializedTypeChangeSingle
  | SerializedTypeChangeMultiple

export class TypeChange extends FeatureChange {
  typeName = 'TypeChange' as const
  changes: TypeChangeDetails[]

  constructor(json: SerializedTypeChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedTypeChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ featureId, newType, oldType }] = changes
      return { typeName, changedIds, assembly, featureId, oldType, newType }
    }
    return { typeName, changedIds, assembly, changes }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger, typeName } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((endChange) => ({
      featureId: endChange.featureId,
      oldType: endChange.newType,
      newType: endChange.oldType,
    }))
    return new TypeChange(
      {
        changedIds: inverseChangedIds,
        typeName,
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}
