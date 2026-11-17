import {
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'

export interface SerializedExampleNotesChange extends SerializedFeatureChange {
  typeName: 'ExampleNotesChange'
  featureId: string
  oldNotes: string[]
  newNotes: string[]
}

/**
 * Replaces the "note" attribute of a feature. A change class only describes
 * the change; the client and the server each apply it with their own handler.
 */
export class ExampleNotesChange extends FeatureChange {
  typeName = 'ExampleNotesChange' as const
  featureId: string
  oldNotes: string[]
  newNotes: string[]

  constructor(json: SerializedExampleNotesChange) {
    super(json)
    this.featureId = json.featureId
    this.oldNotes = json.oldNotes
    this.newNotes = json.newNotes
  }

  toJSON(): SerializedExampleNotesChange {
    const { assembly, changedIds, featureId, newNotes, oldNotes, typeName } =
      this
    return { typeName, assembly, changedIds, featureId, oldNotes, newNotes }
  }

  getInverse() {
    return new ExampleNotesChange({
      ...this.toJSON(),
      oldNotes: this.newNotes,
      newNotes: this.oldNotes,
    })
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification() {
    return 'Notes updated'
  }
}

export function isExampleNotesChange(
  change: unknown,
): change is ExampleNotesChange {
  return (
    (change as Partial<ExampleNotesChange> | undefined)?.typeName ===
    'ExampleNotesChange'
  )
}
