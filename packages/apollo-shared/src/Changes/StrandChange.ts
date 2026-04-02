import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'

interface SerializedStrandChangeBase extends SerializedFeatureChange {
  typeName: 'StrandChange'
}

interface StrandChangeDetails {
  featureId: string
  oldStrand: -1 | 1 | undefined
  newStrand: -1 | 1 | undefined
}

interface SerializedStrandChangeSingle
  extends SerializedStrandChangeBase,
    StrandChangeDetails {}

interface SerializedStrandChangeMultiple extends SerializedStrandChangeBase {
  changes: StrandChangeDetails[]
}

type SerializedStrandChange =
  | SerializedStrandChangeSingle
  | SerializedStrandChangeMultiple

export class StrandChange extends FeatureChange {
  typeName = 'StrandChange' as const
  changes: StrandChangeDetails[]

  constructor(json: SerializedStrandChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedStrandChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ featureId, newStrand, oldStrand }] = changes
      return { typeName, changedIds, assembly, featureId, oldStrand, newStrand }
    }
    return { typeName, changedIds, assembly, changes }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger, typeName } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((endChange) => ({
      featureId: endChange.featureId,
      oldStrand: endChange.newStrand,
      newStrand: endChange.oldStrand,
    }))
    return new StrandChange(
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
