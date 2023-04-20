import { AbstractSessionModel, useDebounce } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  TextField,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { FeatureAttributeChange } from 'apollo-shared'
import { getSnapshot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ChangeManager } from '../ChangeManager'
import { Stores, getDataByID } from './db'

interface ModifyFeatureAttributeProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceAssemblyId: string
  changeManager: ChangeManager
}

const useStyles = makeStyles()((theme) => ({
  attributeInput: {
    maxWidth: 600,
  },
  newAttributePaper: {
    padding: theme.spacing(2),
  },
}))

// Reserved attribute keys
const reservedKeys = [
  { key: 'Ontology_term', id: 1 },
  { key: 'Dbxref', id: 2 },
]

export interface GOTerm {
  id: string
  label: string
}
export function ModifyFeatureAttribute({
  session,
  handleClose,
  sourceFeature,
  sourceAssemblyId,
  changeManager,
}: ModifyFeatureAttributeProps) {
  const { notify } = session
  const [goTerms, setGOTerms] = useState<GOTerm[]>([])
  const [goAttribute, setGoAttribute] = useState(false)
  const [freeKeyAttribute, setFreeKeyAttribute] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [attributes, setAttributes] = useState<Record<string, string[]>>(
    Object.fromEntries(
      Array.from(sourceFeature.attributes.entries()).map(([key, value]) => [
        key,
        getSnapshot(value),
      ]),
    ),
  )
  const [showAddNewForm, setShowAddNewForm] = useState(false)
  const [newAttributeKey, setNewAttributeKey] = useState('')
  const [newAttributeValue, setNewAttributeValue] = useState('')
  const { classes } = useStyles()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const change = new FeatureAttributeChange({
      changedIds: [sourceFeature._id],
      typeName: 'FeatureAttributeChange',
      assembly: sourceAssemblyId,
      featureId: sourceFeature._id,
      attributes,
    })
    changeManager.submit?.(change)
    notify(`Feature attributes modified successfully`, 'success')
    handleClose()
    event.preventDefault()
  }

  function handleChangeAttribute(
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ): void {
    const { id, value } = event.target
    setAttributes({ ...attributes, [id]: value.split(',') })
  }

  function handleAddNewAttributeChange() {
    setErrorMessage('')
    if (newAttributeKey.trim().length < 1) {
      setErrorMessage(`Attribute key is mandatory`)
      return
    }
    if (!freeKeyAttribute && !goAttribute) {
      // Check that value contains "DBTAG:ID"
      if (!newAttributeValue.includes(':')) {
        setErrorMessage(
          `If GO key is "Ontology_term" or "Dbxref" then attribute value must have "DBTAG:ID" -format!`,
        )
        return
      }
    }

    if (newAttributeKey in attributes) {
      setErrorMessage(`Attribute "${newAttributeKey}" already exists`)
    } else {
      setAttributes({
        ...attributes,
        [newAttributeKey]: newAttributeValue.split(','),
      })
      setShowAddNewForm(false)
    }
  }

  function deleteAttribute(key: string) {
    setErrorMessage('')
    const { [key]: remove, ...rest } = attributes
    setAttributes(rest)
  }

  const [goInput, setGoInput] = useState('')
  function handleGOInputChange(_event: unknown, value: string) {
    setGoInput(value)
  }
  const handleGOValueChange = (_event: unknown, newValue: GOTerm[]) => {
    if (newValue.length) {
      setNewAttributeValue(newValue.map((gt) => gt.id).join(','))
    } else {
      setNewAttributeValue('')
    }
  }
  const debouncedGoInput = useDebounce(goInput, 300)
  useEffect(() => {
    async function fetchGoTerms() {
      const gt = await getDataByID(Stores.GOTerms, debouncedGoInput)
      setGOTerms(gt)
    }
    fetchGoTerms()
  }, [debouncedGoInput])

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Feature attributes</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          {Object.entries(attributes).map(([key, value]) => {
            return (
              <Grid container spacing={1} alignItems="flex-end" key={key}>
                <Grid item style={{ minWidth: 550 }}>
                  <TextField
                    id={key}
                    key={key}
                    label={key}
                    type="text"
                    value={value.join(',')}
                    style={{ minWidth: 500 }}
                    onChange={handleChangeAttribute}
                  />
                </Grid>
                <Grid item>
                  <IconButton
                    aria-label="delete"
                    size="medium"
                    onClick={() => {
                      deleteAttribute(key)
                    }}
                  >
                    <DeleteIcon fontSize="medium" key={key} />
                  </IconButton>
                </Grid>
              </Grid>
            )
          })}
          {showAddNewForm ? (
            <Paper elevation={8} className={classes.newAttributePaper}>
              <Grid container direction="column">
                <Grid container>
                  <Grid item>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={goAttribute}
                          onChange={() => {
                            setGoAttribute(!goAttribute)
                            setNewAttributeValue('')
                          }}
                        />
                      }
                      label="Add new gene ontology attribute"
                    />
                  </Grid>
                  <Grid item>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={freeKeyAttribute}
                          onChange={() => {
                            setFreeKeyAttribute(!freeKeyAttribute)
                            setNewAttributeKey('')
                          }}
                        />
                      }
                      label="Attribute key is free text"
                    />
                  </Grid>
                </Grid>
                <Grid item>
                  {freeKeyAttribute ? (
                    <TextField
                      autoFocus
                      margin="dense"
                      label="Attribute key"
                      type="text"
                      fullWidth
                      variant="outlined"
                      onChange={(e) => {
                        setNewAttributeKey(e.target.value)
                      }}
                      className={classes.attributeInput}
                    />
                  ) : (
                    <Autocomplete
                      id="free-solo-demo2"
                      options={reservedKeys.map((option) => option.key)}
                      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                      onChange={(event, value) => setNewAttributeKey(value!)}
                      renderInput={(params) => (
                        <TextField {...params} label="Select key" />
                      )}
                    />
                  )}
                </Grid>
                <Grid item>
                  {goAttribute ? (
                    <Autocomplete
                      id="combo-box-demo"
                      filterSelectedOptions
                      options={goTerms}
                      getOptionLabel={(option) => option.id}
                      renderOption={(props, option: GOTerm) => (
                        <li {...props}>
                          {option.id}&nbsp;&nbsp;&nbsp;{option.label}
                        </li>
                      )}
                      onInputChange={handleGOInputChange}
                      multiple
                      isOptionEqualToValue={(option: GOTerm, value: GOTerm) => {
                        return option.id === value.id
                      }}
                      filterOptions={(x) => x}
                      onChange={handleGOValueChange}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          margin="dense"
                          type="text"
                          variant="outlined"
                          label="GO term"
                          placeholder="Enter search string"
                          className={classes.attributeInput}
                        />
                      )}
                    />
                  ) : (
                    <TextField
                      margin="dense"
                      label="Attribute value"
                      type="text"
                      fullWidth
                      variant="outlined"
                      onChange={(e) => {
                        setNewAttributeValue(e.target.value)
                      }}
                      className={classes.attributeInput}
                    />
                  )}
                </Grid>
              </Grid>
            </Paper>
          ) : null}
          {showAddNewForm ? (
            <DialogActions>
              <Button
                key="addButton"
                color="primary"
                variant="contained"
                style={{ margin: 2 }}
                onClick={handleAddNewAttributeChange}
                disabled={!(newAttributeKey && newAttributeValue)}
              >
                Add
              </Button>
              <Button
                key="cancelAddButton"
                variant="outlined"
                type="submit"
                onClick={() => {
                  setShowAddNewForm(false)
                  setErrorMessage('')
                }}
              >
                Cancel
              </Button>
            </DialogActions>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            color="primary"
            variant="contained"
            disabled={showAddNewForm}
            onClick={() => {
              setShowAddNewForm(true)
            }}
          >
            Add new
          </Button>
          <div style={{ flex: '1 0 0' }} />
          <Button variant="contained" type="submit" disabled={showAddNewForm}>
            Submit changes
          </Button>
          <Button
            variant="outlined"
            type="submit"
            disabled={showAddNewForm}
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </form>
      <DialogContent>
        {errorMessage ? (
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        ) : null}
        <DialogContentText>
          Separate multiple value for the attribute with a comma
        </DialogContentText>
      </DialogContent>
    </Dialog>
  )
}
