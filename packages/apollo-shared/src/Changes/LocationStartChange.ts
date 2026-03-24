/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'

interface SerializedLocationStartChangeBase extends SerializedFeatureChange {
  typeName: 'LocationStartChange'
}

interface LocationStartChangeDetails {
  featureId: string
  oldStart: number
  newStart: number
}

interface SerializedLocationStartChangeSingle
  extends SerializedLocationStartChangeBase,
    LocationStartChangeDetails {}

interface SerializedLocationStartChangeMultiple
  extends SerializedLocationStartChangeBase {
  changes: LocationStartChangeDetails[]
}

export type SerializedLocationStartChange =
  | SerializedLocationStartChangeSingle
  | SerializedLocationStartChangeMultiple

export class LocationStartChange extends FeatureChange {
  typeName = 'LocationStartChange' as const
  changes: LocationStartChangeDetails[]

  constructor(json: SerializedLocationStartChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedLocationStartChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ featureId, newStart, oldStart }] = changes
      return { typeName, changedIds, assembly, featureId, oldStart, newStart }
    }
    return { typeName, changedIds, assembly, changes }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger, typeName } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((startChange) => ({
      featureId: startChange.featureId,
      oldStart: startChange.newStart,
      newStart: startChange.oldStart,
    }))
    return new LocationStartChange(
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

export function isLocationStartChange(
  change: unknown,
): change is LocationStartChange {
  return (change as LocationStartChange).typeName === 'LocationStartChange'
}
