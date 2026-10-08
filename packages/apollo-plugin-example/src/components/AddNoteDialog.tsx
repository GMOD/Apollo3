import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent } from '@mui/material'
import React, { useState } from 'react'

import { NoteTextField } from './NoteTextField.js'

/** Asks for the text of a new note */
export function AddNoteDialog({
  handleClose,
  addNote,
}: {
  handleClose: () => void
  addNote: (note: string) => void
}) {
  const [note, setNote] = useState('')

  return (
    <Dialog open onClose={handleClose} title="Add note" maxWidth="sm" fullWidth>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          addNote(note.trim())
          handleClose()
        }}
      >
        <DialogContent>
          <NoteTextField
            value={note}
            onChange={setNote}
            label="Note"
            autoFocus
            minRows={3}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button
            type="submit"
            color="primary"
            variant="contained"
            disabled={!note.trim()}
          >
            Add
          </Button>
          <Button variant="outlined" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
