import { AbstractSessionModel } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { FeatureAttributeChange } from 'apollo-shared'
import { getSnapshot } from 'mobx-state-tree'
import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ChangeManager } from '../ChangeManager'
import { GoAutocomplete } from './GoAutocomplete'

interface ModifyFeatureAttributeProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceAssemblyId: string
  changeManager: ChangeManager
}

function SoAutocompleteUnimplemented() {
  return <></>
}

const reservedKeys: Map<
  string,
  React.FunctionComponent<AttributeValueEditorProps>
> = new Map([
  ['Gene Ontology', GoAutocomplete],
  ['Sequence Ontology', SoAutocompleteUnimplemented],
])

const useStyles = makeStyles()((theme) => ({
  attributeInput: {
    maxWidth: 600,
  },
  newAttributePaper: {
    padding: theme.spacing(2),
  },
  attributeName: {
    background: theme.palette.secondary.main,
    color: theme.palette.secondary.contrastText,
    padding: theme.spacing(1),
  },
}))

export interface AttributeValueEditorProps {
  value: string[]
  onChange(newValue: string[]): void
}

function CustomAttributeValueEditor(props: AttributeValueEditorProps) {
  const { value, onChange } = props
  return (
    <TextField
      type="text"
      value={value}
      onChange={(event) => {
        onChange(event.target.value.split(','))
      }}
      variant="outlined"
      fullWidth
    />
  )
}

export function ModifyFeatureAttribute({
  session,
  handleClose,
  sourceFeature,
  sourceAssemblyId,
  changeManager,
}: ModifyFeatureAttributeProps) {
  const { notify } = session
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

  function handleAddNewAttributeChange() {
    setErrorMessage('')
    if (newAttributeKey.trim().length < 1) {
      setErrorMessage(`Attribute key is mandatory`)
      return
    }
    if (newAttributeKey in attributes) {
      setErrorMessage(`Attribute "${newAttributeKey}" already exists`)
    } else {
      setAttributes({
        ...attributes,
        [newAttributeKey]: [],
      })
      setShowAddNewForm(false)
    }
  }

  function deleteAttribute(key: string) {
    setErrorMessage('')
    const { [key]: remove, ...rest } = attributes
    setAttributes(rest)
  }

  function makeOnChange(id: string) {
    return (newValue: string[]) => {
      setAttributes({ ...attributes, [id]: newValue })
    }
  }

  function handleRadioButtonChange(
    event: React.ChangeEvent<HTMLInputElement>,
    value: string,
  ) {
    if (value === 'custom') {
      setNewAttributeKey('')
    } else if (reservedKeys.has(value)) {
      setNewAttributeKey(value)
    } else {
      setErrorMessage('Unknown attribute type')
    }
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Feature attributes</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent>
          <Grid container direction="column" spacing={1}>
            {Object.entries(attributes).map(([key, value]) => {
              const EditorComponent =
                reservedKeys.get(key) || CustomAttributeValueEditor
              return (
                <Grid container item spacing={3} alignItems="center" key={key}>
                  <Grid item xs="auto">
                    <Paper variant="outlined" className={classes.attributeName}>
                      <Typography>{key}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item flexGrow={1}>
                    <EditorComponent
                      value={value}
                      onChange={makeOnChange(key)}
                    />
                  </Grid>
                  <Grid item xs={1}>
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
            <Grid item>
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
            </Grid>
            {showAddNewForm ? (
              <Grid item>
                <Paper elevation={8} className={classes.newAttributePaper}>
                  <Grid container direction="column">
                    <Grid item>
                      <FormControl>
                        <FormLabel id="attribute-radio-button-group">
                          Attribute type
                        </FormLabel>
                        <RadioGroup
                          aria-labelledby="demo-radio-buttons-group-label"
                          defaultValue="custom"
                          name="radio-buttons-group"
                          onChange={handleRadioButtonChange}
                        >
                          <FormControlLabel
                            value="custom"
                            control={<Radio />}
                            disableTypography
                            label={
                              <Grid container spacing={1} alignItems="center">
                                <Grid item>
                                  <Typography>Custom</Typography>
                                </Grid>
                                <Grid item>
                                  <TextField
                                    label="Custom attribute key"
                                    variant="outlined"
                                    value={
                                      reservedKeys.has(newAttributeKey)
                                        ? ''
                                        : newAttributeKey
                                    }
                                    disabled={reservedKeys.has(newAttributeKey)}
                                    onChange={(event) => {
                                      setNewAttributeKey(event.target.value)
                                    }}
                                  />
                                </Grid>
                              </Grid>
                            }
                          />
                          {Array.from(reservedKeys.keys()).map((key) => (
                            <FormControlLabel
                              key={key}
                              value={key}
                              control={<Radio />}
                              label={key}
                              // TODO: disable this when SO editor is implemented
                              disabled={key === 'Sequence Ontology'}
                            />
                          ))}
                        </RadioGroup>
                      </FormControl>
                    </Grid>
                    <Grid item>
                      <DialogActions>
                        <Button
                          key="addButton"
                          color="primary"
                          variant="contained"
                          style={{ margin: 2 }}
                          onClick={handleAddNewAttributeChange}
                          disabled={!newAttributeKey}
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
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            ) : null}
          </Grid>
        </DialogContent>
        <DialogActions>
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
          Separate multiple values for an attribute with a comma
        </DialogContentText>
      </DialogContent>
    </Dialog>
  )
}
