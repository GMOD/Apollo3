import { TextField, type TextFieldProps } from '@mui/material'
import React from 'react'

import { MAX_NOTE_LENGTH } from '../shared/ExampleNoteLengthRule.js'

/**
 * A text field that won't accept more than `MAX_NOTE_LENGTH` characters, and
 * shows how many are left
 */
export function NoteTextField({
  value,
  onChange,
  ...props
}: Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <TextField
      {...props}
      value={value}
      onChange={(event) => {
        onChange(event.target.value)
      }}
      multiline
      fullWidth
      helperText={`${value.length}/${MAX_NOTE_LENGTH}`}
      slotProps={{ htmlInput: { maxLength: MAX_NOTE_LENGTH } }}
    />
  )
}
