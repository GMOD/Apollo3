import {
  GFFColumn,
  gffColumnToInternal,
  GFFReservedAttribute,
  gffToInternal,
  isGFFReservedAttribute,
} from '@apollo-annotation/shared'
import {
  Button,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

const customAttributeKeySelectValue = 'Custom'
type AttributeKey =
  | GFFReservedAttribute
  | GFFColumn
  | typeof customAttributeKeySelectValue

const selectValues: AttributeKey[] = [
  customAttributeKeySelectValue,
  ...(Object.keys(gffToInternal) as GFFReservedAttribute[]),
  ...(Object.keys(gffColumnToInternal) as GFFColumn[]),
]

export const AttributeKeySelector = observer(function AttributeKeySelector({
  setKey,
}: {
  setKey: (newKey?: string) => void
}) {
  const [selectedKey, setSelectedKey] = useState<AttributeKey>(
    customAttributeKeySelectValue,
  )
  const [customKey, setCustomKey] = useState<string>()
  const isCustom = selectedKey === customAttributeKeySelectValue

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isCustom) {
      setKey(customKey)
    } else {
      if (isGFFReservedAttribute(selectedKey)) {
        setKey(gffToInternal[selectedKey])
      } else {
        setKey(gffColumnToInternal[selectedKey])
      }
    }
  }
  function handleCancel() {
    setKey()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', margin: 8 }}>
        <FormControl variant="outlined">
          <InputLabel id="attribute-key-select-label">Key</InputLabel>
          <Select
            labelId="attribute-key-select-label"
            value={selectedKey}
            label="key"
            onChange={(event) => {
              setSelectedKey(event.target.value as AttributeKey)
            }}
          >
            {selectValues.map((val) => (
              <MenuItem key={val} value={val}>
                {val === customAttributeKeySelectValue ? '' : 'GFF '}
                {val}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {isCustom ? (
          <TextField
            label="Attribute key"
            variant="outlined"
            id="attributeKey"
            onChange={(event) => {
              setCustomKey(event.target.value)
            }}
          />
        ) : null}
      </div>
      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          type="submit"
          disabled={isCustom && !customKey}
        >
          Add
        </Button>
        <Button variant="outlined" onClick={handleCancel}>
          Cancel
        </Button>
      </DialogActions>
    </form>
  )
})
