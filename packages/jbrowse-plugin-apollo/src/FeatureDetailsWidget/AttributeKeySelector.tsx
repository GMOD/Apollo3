import { gffColumnToInternal, gffToInternal } from '@apollo-annotation/shared'
import { getEnv } from '@jbrowse/core/util'
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
import { ApolloSessionModel } from '../session'

const customKeyName = 'Custom'
const gffKeys: Record<string, string | undefined> = {
  [customKeyName]: 'custom',
}

for (const [value, key] of Object.entries(gffToInternal)) {
  gffKeys[`GFF ${key}`] = value
}
for (const [value, key] of Object.entries(gffColumnToInternal)) {
  gffKeys[`GFF ${key}`] = value
}

export const AttributeKeySelector = observer(function AttributeKeySelector({
  setKey,
  session,
}: {
  setKey: (newKey?: string) => void
  session: ApolloSessionModel
}) {
  const { pluginManager } = getEnv(session)
  const reservedKeys = pluginManager.evaluateExtensionPoint(
    'Apollo-ReservedAttributeKeys',
    gffKeys,
  ) as Record<string, string | undefined>
  const firstKey = Object.keys(reservedKeys).at(0) ?? customKeyName
  const [selectedKey, setSelectedKey] = useState<string>(firstKey)
  const [customKey, setCustomKey] = useState<string>()
  const isCustom = selectedKey === customKeyName

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isCustom) {
      setKey(customKey)
      return
    }
    setKey(reservedKeys[selectedKey])
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
            label="Key"
            onChange={(event) => {
              setSelectedKey(event.target.value)
            }}
          >
            {Object.keys(reservedKeys).map((val) => (
              <MenuItem key={val} value={val}>
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
