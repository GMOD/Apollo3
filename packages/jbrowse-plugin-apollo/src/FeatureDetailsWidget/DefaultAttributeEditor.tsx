import { Button, DialogActions } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

import { StringTextField } from './StringTextField'

export const DefaultAttributeEditor = observer(function DefaultAttributeEditor({
  attributeValues,
  setAttribute,
  isNew = false,
}: {
  attributeValues?: string[]
  setAttribute: (newAttribute?: string[]) => void
  isNew?: boolean
}) {
  const [newValues, setNewValues] = useState(attributeValues)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <StringTextField
        value={newValues}
        onChangeCommitted={(editedValues) => {
          setNewValues(editedValues.split(','))
        }}
        variant="outlined"
        fullWidth
        style={{ width: '100%' }}
      />
      <DialogActions>
        <Button
          key="addButton"
          color="primary"
          variant="contained"
          onClick={() => {
            setAttribute(newValues)
          }}
        >
          {isNew ? 'Add' : 'Update'}
        </Button>
        <Button
          key="cancelAddButton"
          variant="outlined"
          type="submit"
          onClick={() => {
            setAttribute()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </div>
  )
})
