/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { AnnotationFeatureI } from '@apollo-annotation/apollo-mst'
import { FeatureAttributeChange } from '@apollo-annotation/apollo-shared'
import { AbstractSessionModel } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  DialogActions,
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
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { AttributeValueEditorProps } from '../components'
import { OntologyTermMultiSelect } from '../components/OntologyTermMultiSelect'
import { ApolloSessionModel } from '../session'
import { StringTextField } from './StringTextField'

const reservedKeys = new Map([
  [
    'Gene Ontology',
    (props: AttributeValueEditorProps) => {
      return <OntologyTermMultiSelect {...props} ontologyName="Gene Ontology" />
    },
  ],
  [
    'Sequence Ontology',
    (props: AttributeValueEditorProps) => {
      return (
        <OntologyTermMultiSelect {...props} ontologyName="Sequence Ontology" />
      )
    },
  ],
])

const reservedTerms = [
  'ID',
  'Name',
  'Alias',
  'Target',
  'Gap',
  'Derives_from',
  'Note',
  'Dbxref',
  'Ontology',
  'Is_Circular',
]

const useStyles = makeStyles()((theme) => ({
  newAttributePaper: {
    padding: theme.spacing(2),
  },
  attributeName: {
    background: theme.palette.secondary.main,
    color: theme.palette.secondary.contrastText,
    padding: theme.spacing(1),
  },
}))

function CustomAttributeValueEditor(props: AttributeValueEditorProps) {
  const { onChange, value } = props
  return (
    <StringTextField
      value={value}
      onChangeCommitted={(newValue) => {
        onChange(newValue.split(','))
      }}
      variant="outlined"
      fullWidth
      helperText="Separate multiple values for the attribute with commas"
    />
  )
}

export const Attributes = observer(function Attributes({
  assembly,
  editable,
  feature,
  session,
}: {
  feature: AnnotationFeatureI
  session: ApolloSessionModel
  assembly: string
  editable: boolean
}) {
  const [errorMessage, setErrorMessage] = useState('')
  const [showAddNewForm, setShowAddNewForm] = useState(false)
  const { classes } = useStyles()
  const [newAttributeKey, setNewAttributeKey] = useState('')
  const attributes = Object.fromEntries(
    [...feature.attributes.entries()].map(([key, value]) => {
      if (key.startsWith('gff_')) {
        const newKey = key.slice(4)
        const capitalizedKey = newKey.charAt(0).toUpperCase() + newKey.slice(1)
        return [capitalizedKey, getSnapshot(value)]
      }
      if (key === '_id') {
        return ['ID', getSnapshot(value)]
      }
      return [key, getSnapshot(value)]
    }),
  )
  const { notify } = session as unknown as AbstractSessionModel

  const { changeManager } = session.apolloDataStore

  async function onChangeCommitted(newKey: string, newValue?: string[]) {
    setErrorMessage('')

    const attrs: Record<string, string[]> = {}
    if (attributes) {
      const modifiedAttrs = Object.entries({
        ...attributes,
        [newKey]: newValue,
      })
      for (const [key, val] of modifiedAttrs) {
        if (!val) {
          continue
        }
        const newKey = key.toLowerCase()
        if (newKey === 'parent') {
          continue
        }
        if ([...reservedKeys.keys()].includes(key)) {
          attrs[key] = val
          continue
        }
        switch (key) {
          case 'ID': {
            attrs._id = val
            break
          }
          case 'Name': {
            attrs.gff_name = val
            break
          }
          case 'Alias': {
            attrs.gff_alias = val
            break
          }
          case 'Target': {
            attrs.gff_target = val
            break
          }
          case 'Gap': {
            attrs.gff_gap = val
            break
          }
          case 'Derives_from': {
            attrs.gff_derives_from = val
            break
          }
          case 'Note': {
            attrs.gff_note = val
            break
          }
          case 'Dbxref': {
            attrs.gff_dbxref = val
            break
          }
          case 'Ontology_term': {
            attrs.gff_ontology_term = val
            break
          }
          case 'Is_circular': {
            attrs.gff_is_circular = val
            break
          }
          default: {
            attrs[key.toLowerCase()] = val
          }
        }
      }
    }

    const change = new FeatureAttributeChange({
      changedIds: [feature._id],
      typeName: 'FeatureAttributeChange',
      assembly,
      featureId: feature._id,
      attributes: attrs,
    })
    await changeManager.submit(change)
    notify('Feature attributes modified successfully', 'success')
  }
  function handleAddNewAttributeChange() {
    setErrorMessage('')
    if (newAttributeKey.trim().length === 0) {
      setErrorMessage('Attribute key is mandatory')
      return
    }
    if (newAttributeKey === 'Parent') {
      setErrorMessage(
        '"Parent" -key is handled internally and it cannot be modified manually',
      )
      return
    }
    if (newAttributeKey in attributes) {
      setErrorMessage(`Attribute "${newAttributeKey}" already exists`)
      return
    }
    if (
      /^[A-Z]/.test(newAttributeKey) &&
      !reservedTerms.includes(newAttributeKey) &&
      ![...reservedKeys.keys()].includes(newAttributeKey)
    ) {
      setErrorMessage(
        `Key cannot starts with uppercase letter unless key is one of these: ${reservedTerms.join(
          ', ',
        )}`,
      )
      return
    }
    void onChangeCommitted(newAttributeKey, [])
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
    <>
      <Typography variant="h4">Attributes</Typography>
      <Grid container direction="column" spacing={1}>
        {Object.entries(attributes).map(([key, value]) => {
          const EditorComponent =
            reservedKeys.get(key) ?? CustomAttributeValueEditor
          return (
            <Grid container item spacing={3} alignItems="center" key={key}>
              <Grid item xs="auto">
                <Paper variant="outlined" className={classes.attributeName}>
                  <Typography>{key}</Typography>
                </Paper>
              </Grid>
              <Grid item flexGrow={1}>
                <EditorComponent
                  session={session}
                  value={value}
                  onChange={(newValue) => onChangeCommitted(key, newValue)}
                />
              </Grid>
              <Grid item xs={1}>
                <IconButton
                  aria-label="delete"
                  size="medium"
                  disabled={!editable}
                  onClick={() => onChangeCommitted(key)}
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
            disabled={showAddNewForm || !editable}
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
                      Select attribute type
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
                      {[...reservedKeys.keys()].map((key) => (
                        <FormControlLabel
                          key={key}
                          value={key}
                          control={<Radio />}
                          label={key}
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
                        setNewAttributeKey('')
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
      {errorMessage ? (
        <Typography color="error">{errorMessage}</Typography>
      ) : null}
    </>
  )
})
