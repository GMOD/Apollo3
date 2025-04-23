import { Button, DialogActions, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import React from 'react'

interface FormElements extends HTMLFormControlsCollection {
  attributeKey: HTMLInputElement
}
interface AttributeKeyFormElement extends HTMLFormElement {
  readonly elements: FormElements
}

export const AddNewAttribute = observer(function AddNewAttribute({
  setKey,
}: {
  setKey: (newKey?: string) => void
}) {
  function handleSubmit(event: React.FormEvent<AttributeKeyFormElement>) {
    event.preventDefault()
    setKey(event.currentTarget.elements.attributeKey.value)
  }
  function handleCancel() {
    setKey()
  }

  return (
    <form onSubmit={handleSubmit}>
      <TextField label="Attribute key" variant="outlined" id="attributeKey" />
      <DialogActions>
        <Button color="primary" variant="contained" type="submit">
          Add
        </Button>
        <Button variant="outlined" onClick={handleCancel}>
          Cancel
        </Button>
      </DialogActions>
    </form>
  )
})
