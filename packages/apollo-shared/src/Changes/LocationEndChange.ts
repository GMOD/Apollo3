/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'

interface SerializedLocationEndChangeBase extends SerializedFeatureChange {
  typeName: 'LocationEndChange'
}

export interface LocationEndChangeDetails {
  featureId: string
  oldEnd: number
  newEnd: number
}

interface SerializedLocationEndChangeSingle
  extends SerializedLocationEndChangeBase,
    LocationEndChangeDetails {}

interface SerializedLocationEndChangeMultiple
  extends SerializedLocationEndChangeBase {
  changes: LocationEndChangeDetails[]
}

export type SerializedLocationEndChange =
  | SerializedLocationEndChangeSingle
  | SerializedLocationEndChangeMultiple

export class LocationEndChange extends FeatureChange {
  typeName = 'LocationEndChange' as const
  changes: LocationEndChangeDetails[]

  constructor(json: SerializedLocationEndChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedLocationEndChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ featureId, newEnd, oldEnd }] = changes
      return { typeName, changedIds, assembly, featureId, oldEnd, newEnd }
    }
    return { typeName, changedIds, assembly, changes }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger, typeName } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((endChange) => ({
      featureId: endChange.featureId,
      oldEnd: endChange.newEnd,
      newEnd: endChange.oldEnd,
    }))
    return new LocationEndChange(
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

export function isLocationEndChange(
  change: unknown,
): change is LocationEndChange {
  return (change as LocationEndChange).typeName === 'LocationEndChange'
}
