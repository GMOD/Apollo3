import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { ChangeManager, FeatureAttributeChange } from 'apollo-shared'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface ModifyFeatureAttributeProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceAssemblyId: string
  changeManager: ChangeManager
}

interface Collection {
  key: string
  value: string[]
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
  const [errorMessage, setErrorMessage] = useState('')
  const [collection, setCollection] = useState<Collection[]>([])
  const [addNew, setAddNew] = useState(false)
  const [attributeNewValue, setAttributeNewValue] = useState('')
  const [newAttributeKey, setNewAttributeKey] = useState('')
  const [newAttributeValue, setNewAttributeValue] = useState('')

  useEffect(() => {
    async function getFeatureAttributes() {
      console.log(
        `Attributes client : "${JSON.stringify(sourceFeature.attributes)}"`,
      )
      // If we fetch feature attributes from local data store then we use code below
      sourceFeature.attributes.forEach((value: string[], key: string) => {
        setCollection((result) => [
          ...result,
          {
            key,
            value,
          },
        ])
      })
      // // If we fetch feature attributes directly from Mongo then we use code below
      // const tmpUrl = `/features/getAttributes/${sourceFeature._id}`
      // const uri = new URL(tmpUrl, baseURL).href
      // const apolloFetch = apolloInternetAccount?.getFetcher({
      //   locationType: 'UriLocation',
      //   uri,
      // })
      // if (apolloFetch) {
      //   const response = await apolloFetch(uri, {
      //     method: 'GET',
      //   })
      //   if (!response.ok) {
      //     let msg
      //     try {
      //       msg = await response.text()
      //     } catch (e) {
      //       msg = ''
      //     }
      //     setErrorMessage(
      //       `Error when retrieving feature attributes — ${response.status} (${
      //         response.statusText
      //       })${msg ? ` (${msg})` : ''}`,
      //     )
      //     return
      //   }
      //   const data = await response.json()
      //   Object.keys(data).forEach(function (key) {
      //     console.log(`Key : "${key}", value : "${data[key]}"`)
      //     setCollection((result) => [
      //       ...result,
      //       {
      //         key,
      //         value: data[key],
      //       },
      //     ])
      //   })
      // }
    }
    getFeatureAttributes()
    return () => {
      setCollection([{ key: '', value: [''] }])
    }
  }, [apolloInternetAccount, baseURL, sourceAssemblyId, sourceFeature])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const attributes: Record<string, string[]> = {}

    collection.forEach((item) => {
      // console.log(`Collection "${item.key}" value is "${item.value}"`)
      attributes[item.key] = item.value
    })

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

  function handleChangeAtt(value: string, id: string): void {
    setAttributeNewValue(value)
    collection.forEach((item) => {
      if (item.key === id) {
        item.value = [value]
      }
    })
  }

  function handleChangeAddNewAttribute() {
    setErrorMessage('')
    let ok = true
    collection.forEach((item) => {
      // Find correct element and delete it
      if (item.key === newAttributeKey) {
        setErrorMessage(`Attribute key "${newAttributeKey}" already exists!`)
        ok = false
      }
    })
    if (ok) {
      setCollection((result) => [
        ...result,
        {
          key: newAttributeKey,
          value: [newAttributeValue],
        },
      ])
      setAddNew(false)
    }
  }
  function deleteAttribute(key: string) {
    setErrorMessage('')
    let ind = 0
    collection.forEach((item) => {
      // Find correct element and delete it
      if (item.key === key) {
        collection.splice(ind, 1)
      }
      ind++
    })
    setCollection((result) => [...result])
  }
  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Feature attributes</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          {collection.map((attribute) => {
            return (
              <>
                <Grid container spacing={1} alignItems="flex-end">
                  <Grid item style={{ width: 500 }}>
                    <TextField
                      id={attribute.key}
                      key={attribute.key}
                      label={attribute.key}
                      type="text"
                      value={attribute.value}
                      style={{ width: 500 }}
                      onChange={(e) =>
                        handleChangeAtt(e.target.value, e.target.id)
                      }
                    />
                  </Grid>
                  <Grid item>
                    <IconButton
                      aria-label="delete"
                      size="medium"
                      key={attribute.key}
                      onClick={() => {
                        deleteAttribute(attribute.key)
                      }}
                    >
                      <DeleteIcon fontSize="medium" key={attribute.key} />
                    </IconButton>
                  </Grid>
                </Grid>
              </>
            )
          })}

          {addNew ? (
            <DialogContent>
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
            </DialogContent>
          ) : null}
          {addNew ? (
            <DialogActions>
              <Button
                key="addButton"
                color="primary"
                variant="contained"
                style={{ margin: 2 }}
                onClick={() => {
                  setAddNew(true)
                  handleChangeAddNewAttribute()
                }}
              >
                Add
              </Button>
              <Button
                key="cancelAddButton"
                variant="outlined"
                type="submit"
                onClick={() => {
                  setAddNew(false)
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
            disabled={addNew}
            onClick={() => {
              setAddNew(true)
            }}
          >
            Add new
          </Button>
          <div style={{ flex: '1 0 0' }} />
          <Button variant="contained" type="submit" disabled={addNew}>
            Submit changes
          </Button>
          <Button
            variant="outlined"
            type="submit"
            disabled={addNew}
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </form>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
