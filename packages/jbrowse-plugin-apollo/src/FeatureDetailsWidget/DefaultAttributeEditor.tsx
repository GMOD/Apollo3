import AddBoxIcon from '@mui/icons-material/AddBox'
import DeleteIcon from '@mui/icons-material/Delete'
import { Button, DialogActions, IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

import { type ApolloSessionModel } from '../session'

import { StringTextField } from './StringTextField'

export interface AttributeEditorProps {
  session: ApolloSessionModel
  attributeValues?: string[]
  setAttribute: (newAttribute?: string[]) => void
  isNew?: boolean
}

export const DefaultAttributeEditor = observer(function DefaultAttributeEditor({
  attributeValues,
  setAttribute,
  isNew = false,
}: AttributeEditorProps) {
  const [newValues, setNewValues] = useState<string[]>(
    attributeValues && attributeValues.length > 0 ? attributeValues : [''],
  )

  function updateValue(idx: number, newValue: string) {
    setNewValues((oldValues) => {
      const newValues = [...oldValues]
      newValues[idx] = newValue
      return newValues
    })
  }
  function deleteValue(idx: number) {
    setNewValues((oldValues) => {
      const newValues = [...oldValues]
      newValues.splice(idx, 1)
      return newValues
    })
  }
  function addValue() {
    setNewValues((oldValues) => {
      const newValues = [...oldValues]
      newValues.push('')
      return newValues
    })
  }

  return (
    <>
      {newValues.map((value, idx) => (
        <div key={`${idx}-${value}`} style={{ display: 'flex' }}>
          <StringTextField
            value={value}
            onChangeCommitted={(editedValue) => {
              updateValue(idx, editedValue)
            }}
            variant="outlined"
            fullWidth
          />
          <IconButton
            aria-label="delete"
            size="medium"
            edge="end"
            onClick={() => {
              deleteValue(idx)
            }}
          >
            <DeleteIcon fontSize="inherit" />
          </IconButton>
        </div>
      ))}
      <IconButton
        aria-label="add"
        size="medium"
        color="secondary"
        edge="start"
        onClick={addValue}
      >
        <AddBoxIcon fontSize="inherit" />
      </IconButton>
      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            setAttribute(newValues.filter(Boolean))
          }}
        >
          {isNew ? 'Add' : 'Update'}
        </Button>
        <Button
          variant="outlined"
          type="submit"
          onClick={() => {
            setAttribute()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})
