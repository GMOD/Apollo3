/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  type ChangeOptions,
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'

interface SerializedFeatureAttributeChangeBase extends SerializedFeatureChange {
  typeName: 'FeatureAttributeChange'
}

export interface FeatureAttributeChangeDetails {
  featureId: string
  oldAttributes: Record<string, string[]>
  newAttributes: Record<string, string[]>
}

interface SerializedFeatureAttributeChangeSingle
  extends SerializedFeatureAttributeChangeBase,
    FeatureAttributeChangeDetails {}

interface SerializedFeatureAttributeChangeMultiple
  extends SerializedFeatureAttributeChangeBase {
  changes: FeatureAttributeChangeDetails[]
}

export type SerializedFeatureAttributeChange =
  | SerializedFeatureAttributeChangeSingle
  | SerializedFeatureAttributeChangeMultiple

export class FeatureAttributeChange extends FeatureChange {
  typeName = 'FeatureAttributeChange' as const
  changes: FeatureAttributeChangeDetails[]

  constructor(json: SerializedFeatureAttributeChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedFeatureAttributeChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ oldAttributes, newAttributes, featureId }] = changes
      return {
        typeName,
        changedIds,
        assembly,
        featureId,
        oldAttributes,
        newAttributes,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  getInverse() {
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes].reverse().map((oneChange) => ({
      featureId: oneChange.featureId,
      oldAttributes: oneChange.newAttributes,
      newAttributes: oneChange.oldAttributes,
    }))
    return new FeatureAttributeChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'FeatureAttributeChange',
        changes: inverseChanges,
        assembly,
      },
      { logger },
    )
  }
}

export function isFeatureAttributeChange(
  change: unknown,
): change is FeatureAttributeChange {
  return (
    (change as FeatureAttributeChange).typeName === 'FeatureAttributeChange'
  )
}
