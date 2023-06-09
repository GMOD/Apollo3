import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
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
import { getRoot, getSnapshot } from 'mobx-state-tree'
import React, { useMemo, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
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
      helperText="Separate multiple values for the attribute with commas"
    />
  )
}

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

  const { internetAccounts } = getRoot(session) as AppRootModel
  const internetAccount = useMemo(() => {
    const apolloInternetAccount = internetAccounts.find(
      (ia) => ia.type === 'ApolloInternetAccount',
    ) as ApolloInternetAccountModel | undefined
    if (!apolloInternetAccount) {
      throw new Error('No Apollo internet account found')
    }
    return apolloInternetAccount
  }, [internetAccounts])
  const editable =
    Boolean(internetAccount.authType) &&
    ['admin', 'user'].includes(internetAccount.getRole() || '')

  const [errorMessage, setErrorMessage] = useState('')
  const [attributes, setAttributes] = useState<Record<string, string[]>>(
    Object.fromEntries(
      Array.from(sourceFeature.attributes.entries()).map(([key, value]) => {
        if (key.startsWith('gff_')) {
          const newKey = key.substring(4)
          const capitalizedKey =
            newKey.charAt(0).toUpperCase() + newKey.slice(1)
          return [capitalizedKey, getSnapshot(value)]
        }
        if (key === '_id') {
          return ['ID', getSnapshot(value)]
        }
        return [key, getSnapshot(value)]
      }),
    ),
  )
  const [showAddNewForm, setShowAddNewForm] = useState(false)
  const [newAttributeKey, setNewAttributeKey] = useState('')
  const { classes } = useStyles()
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const attrs: Record<string, string[]> = {}
    if (attributes) {
      Object.entries(attributes).forEach(([key, val]) => {
        if (!val) {
          return
        }
        const newKey = key.toLowerCase()
        if (newKey === 'parent') {
          return
        }
        if (Array.from(reservedKeys.keys()).includes(key)) {
          attrs[key] = val
          return
        }
        switch (key) {
          case 'ID':
            attrs._id = val
            break
          case 'Name':
            attrs.gff_name = val
            break
          case 'Alias':
            attrs.gff_alias = val
            break
          case 'Target':
            attrs.gff_target = val
            break
          case 'Gap':
            attrs.gff_gap = val
            break
          case 'Derives_from':
            attrs.gff_derives_from = val
            break
          case 'Note':
            attrs.gff_note = val
            break
          case 'Dbxref':
            attrs.gff_dbxref = val
            break
          case 'Ontology_term':
            attrs.gff_ontology_term = val
            break
          case 'Is_circular':
            attrs.gff_is_circular = val
            break
          default:
            attrs[key.toLowerCase()] = val
        }
      })
    }

    const change = new FeatureAttributeChange({
      changedIds: [sourceFeature._id],
      typeName: 'FeatureAttributeChange',
      assembly: sourceAssemblyId,
      featureId: sourceFeature._id,
      attributes: attrs,
    })
    await changeManager.submit?.(change)
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
    if (newAttributeKey === 'Parent') {
      setErrorMessage(
        `"Parent" -key is handled internally and it cannot be modified manually`,
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
      !Array.from(reservedKeys.keys()).includes(newAttributeKey)
    ) {
      setErrorMessage(
        `Key cannot starts with uppercase letter unless key is one of these: ${reservedTerms.join(
          ', ',
        )}`,
      )
      return
    }
    setAttributes({
      ...attributes,
      [newAttributeKey]: [],
    })
    setShowAddNewForm(false)
    setNewAttributeKey('')
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

  const hasEmptyAttributes = Object.values(attributes).some(
    (value) => value.length === 0 || value.some((v) => v === ''),
  )

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
                      disabled={!editable}
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
            <DialogContentText color="error">{errorMessage}</DialogContentText>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            type="submit"
            disabled={showAddNewForm || hasEmptyAttributes || !editable}
          >
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

      {/* <DialogContentText>
          Separate multiple values for an attribute with a comma
        </DialogContentText> */}
    </Dialog>
  )
}
