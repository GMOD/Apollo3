import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
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
  TextField,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { FeatureAttributeChange } from 'apollo-shared'
import { getRoot, getSnapshot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ChangeManager } from '../ChangeManager'

interface ModifyFeatureAttributeProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceAssemblyId: string
  changeManager: ChangeManager
}

// Reserved attribute keys
const reservedKeys = [
  { key: 'Ontology_term', id: 1 },
  { key: 'Dbxref', id: 2 },
]

interface GOTerm {
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
  const { internetAccounts } = getRoot(session) as AppRootModel
  const { notify } = session
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [goTerm, setGOTerms] = useState<GOTerm[]>([])
  const [goAttribute, setGoAttribute] = useState(false)
  const [freeKeyAttribute, setFreeKeyAttribute] = useState(true)
  const [selectedGoValue, setSelectedGoValue] = useState('')
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
  useEffect(() => {
    async function getGOTerms() {
      const uri = new URL('/ontologies/go/findall', baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, {
          method: 'GET',
        })
        if (!response.ok) {
          setErrorMessage('Error when fetching GO terms from server')
          return
        }
        const data = await response.json()
        data.forEach((item: GOTerm) => {
          setGOTerms((result) => [
            ...result,
            {
              id: item.id,
              label: item.label,
            },
          ])
        })
      }
    }
    getGOTerms()
    return () => {
      setGOTerms([{ id: '', label: '' }])
    }
  }, [])

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
    if (newAttributeKey in attributes) {
      setErrorMessage(`Attribute "${newAttributeKey}" already exists`)
    } else {
      setErrorMessage('')
      setAttributes({
        ...attributes,
        [newAttributeKey]: newAttributeValue.split(','),
      })
      setShowAddNewForm(false)
    }
    console.log(`KEY: "${newAttributeKey}"`)
    console.log(`GO-ARVO: "${selectedGoValue}"`)
    console.log(`MUU-ARVO: "${newAttributeValue}"`)
  }
  function deleteAttribute(key: string) {
    setErrorMessage('')
    const { [key]: remove, ...rest } = attributes
    setAttributes(rest)
  }
  // function handleChangeAttributeType(e: SelectChangeEvent<string>) {
  //   setAssemblyId(e.target.value as string)
  // }
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
            <DialogContent style={{ border: '5px solid rgba(0, 0, 0, 0.05)' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={goAttribute}
                    onChange={() => setGoAttribute(!goAttribute)}
                  />
                }
                label="Add new gene ontology attribute"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={freeKeyAttribute}
                    onChange={() => setFreeKeyAttribute(!freeKeyAttribute)}
                  />
                }
                label="Attribute key is free text"
              />
              {!freeKeyAttribute ? (
                <Autocomplete
                  id="free-solo-demo2"
                  // freeSolo
                  options={reservedKeys.map((option) => option.key)}
                  onChange={(event, value) => setNewAttributeKey(value!)}
                  renderInput={(params) => (
                    <TextField {...params} label="Select key" />
                  )}
                />
              ) : null}
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
                />
              ) : null}
              {!goAttribute ? (
                <TextField
                  margin="dense"
                  label="Attribute value"
                  type="text"
                  fullWidth
                  variant="outlined"
                  onChange={(e) => {
                    setNewAttributeValue(e.target.value)
                  }}
                />
              ) : null}
              {goAttribute ? (
                <Autocomplete
                  id="free-solo-demo"
                  multiple={true}
                  // freeSolo
                  options={goTerm.map((option) => option.id)}
                  // onChange={(event, value) => setNewAttributeValue(value!)}
                  renderInput={(params) => (
                    <TextField {...params} label="Select GO term" />
                  )}
                />
              ) : null}
            </DialogContent>
          ) : null}
          {showAddNewForm ? (
            <DialogActions>
              <Button
                key="addButton"
                color="primary"
                variant="contained"
                style={{ margin: 2 }}
                onClick={handleAddNewAttributeChange}
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
        <DialogContentText>
          Separate multiple value for the attribute with a comma
        </DialogContentText>
        {errorMessage ? (
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
