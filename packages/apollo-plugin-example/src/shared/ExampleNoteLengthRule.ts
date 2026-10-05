import { type Change, ChangeRule } from '@apollo-annotation/common'

import { isExampleNotesChange } from './ExampleNotesChange.js'

export const MAX_NOTE_LENGTH = 200

/**
 * A change rule only looks at the change itself, so Apollo runs it on both the
 * client and the server
 */
export class ExampleNoteLengthRule extends ChangeRule {
  name = 'ExampleNoteLengthRule'

  validate(change: Change) {
    if (!isExampleNotesChange(change)) {
      return
    }
    const tooLong = change.newNotes.find(
      (note) => note.length > MAX_NOTE_LENGTH,
    )
    if (tooLong) {
      return `Notes can be at most ${MAX_NOTE_LENGTH} characters long`
    }
    return
  }
}
