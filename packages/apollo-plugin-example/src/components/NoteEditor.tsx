import type { AttributeEditorProps } from '@apollo-annotation/common/client'
import { Button, DialogActions, IconButton } from '@mui/material'
import React, { useState } from 'react'

import { NoteTextField } from './NoteTextField.js'

/**
 * Edits the "note" attribute. `ExampleNoteLengthRule` rejects notes that are
 * too long; the editor also limits their length so they can't be typed.
 */
export function NoteEditor({
  attributeValues,
  setAttribute,
  isNew = false,
}: AttributeEditorProps) {
  const [notes, setNotes] = useState<string[]>(
    attributeValues?.length ? attributeValues : [''],
  )

  return (
    <>
      {notes.map((note, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start' }}>
          <NoteTextField
            value={note}
            onChange={(newNote) => {
              setNotes(notes.map((n, i) => (i === idx ? newNote : n)))
            }}
            variant="outlined"
            size="small"
            margin="dense"
          />
          <IconButton
            aria-label="delete note"
            onClick={() => {
              setNotes(notes.filter((_, i) => i !== idx))
            }}
          >
            ×
          </IconButton>
        </div>
      ))}
      <Button
        size="small"
        onClick={() => {
          setNotes([...notes, ''])
        }}
      >
        Add another note
      </Button>
      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            setAttribute(notes.filter(Boolean))
          }}
        >
          {isNew ? 'Add' : 'Update'}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setAttribute()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
}
