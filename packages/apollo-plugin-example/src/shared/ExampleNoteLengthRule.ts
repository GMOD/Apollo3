import { type Change, ChangeRule } from '@apollo-annotation/common'

import { isExampleNotesChange } from './ExampleNotesChange.js'

export const MAX_NOTE_LENGTH = 200

/**
 * The parts of Apollo's `FeatureAttributeChange` (from
 * `@apollo-annotation/shared`) this rule reads. Apollo submits one when an
 * attribute is edited in the feature details widget.
 */
interface FeatureAttributeChangeLike {
  typeName: 'FeatureAttributeChange'
  changes: {
    oldAttributes: Record<string, string[] | undefined>
    newAttributes: Record<string, string[] | undefined>
  }[]
}

function isFeatureAttributeChange(
  change: unknown,
): change is FeatureAttributeChangeLike {
  return (
    (change as Partial<FeatureAttributeChangeLike> | undefined)?.typeName ===
    'FeatureAttributeChange'
  )
}

/**
 * Notes a change adds that are too long. Notes the feature already had are
 * allowed, so a feature with an over-long note can still be edited.
 */
function tooLongNotes(oldNotes: string[] = [], newNotes: string[] = []) {
  return newNotes.filter(
    (note) => note.length > MAX_NOTE_LENGTH && !oldNotes.includes(note),
  )
}

/**
 * A change rule only looks at the change itself, so Apollo runs it on both the
 * client and the server. It checks notes set with `ExampleNotesChange` and
 * with Apollo's own `FeatureAttributeChange`.
 */
export class ExampleNoteLengthRule extends ChangeRule {
  name = 'ExampleNoteLengthRule'

  validate(change: Change) {
    let tooLong: string[] = []
    if (isExampleNotesChange(change)) {
      tooLong = tooLongNotes(change.oldNotes, change.newNotes)
    } else if (isFeatureAttributeChange(change)) {
      tooLong = change.changes.flatMap(({ oldAttributes, newAttributes }) =>
        tooLongNotes(oldAttributes.note, newAttributes.note),
      )
    }
    if (tooLong.length > 0) {
      return `Notes can be at most ${MAX_NOTE_LENGTH} characters long`
    }
    return
  }
}
