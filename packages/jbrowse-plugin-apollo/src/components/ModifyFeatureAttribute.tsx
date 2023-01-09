import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  SelectChangeEvent,
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
  const [attributeLine, setAttribureLine] = useState('')
  // const [attributeValue, setAttributeValue] = useState<string[]>([])
  const [attributeNewValue, setAttributeNewValue] = useState('')
  const [attributeKey, setAttributeKey] = useState('')

  useEffect(() => {
    async function getFeatureAttributes() {
      const tmpUrl = `/features/getAttributes/${sourceFeature._id}`
      const uri = new URL(tmpUrl, baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, {
          method: 'GET',
        })
        if (!response.ok) {
          let msg
          try {
            msg = await response.text()
          } catch (e) {
            msg = ''
          }
          setErrorMessage(
            `Error when retrieving feature attributes — ${response.status} (${
              response.statusText
            })${msg ? ` (${msg})` : ''}`,
          )
          return
        }
        const data = await response.json()
        console.log(`Backend response: ${JSON.stringify(data)}`)
        Object.keys(data).forEach(function (key) {
          console.log(`Key : "${key}", value : "${data[key]}"`)
          setCollection((result) => [
            ...result,
            {
              key,
              value: data[key],
            },
          ])
        })
      }
    }
    getFeatureAttributes()
    return () => {
      setCollection([{ key: '', value: [''] }])
    }
  }, [apolloInternetAccount, baseURL, sourceAssemblyId, sourceFeature])

  function handleChangeAttribute(e: SelectChangeEvent<string>) {
    const valArray = e.target.value.split('=')
    setAttributeKey(valArray[0].trim())
    setAttributeNewValue(valArray[1].trim())
  }

  function handleChangeAttributeValue(value: string): void {
    setAttributeNewValue(value)
    let ind = 0
    collection.forEach((item) => {
      // Find correct element and update its value (or delete if value has been removed)
      if (item.key === attributeKey) {
        if (value.trim().length === 0) {
          collection.splice(ind, 1)
          ind++
        } else {
          item.value = [value]
        }
      }
    })
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const attributes: Record<string, string[]> = {}

    collection.forEach((item) => {
      console.log(`Collection "${item.key}" value is "${item.value}"`)
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
    notify(`Feature attributes added/edited/deleted successfully`, 'success')
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Feature attributes</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Select attribute</DialogContentText>
          <Select
            labelId="label"
            value={attributeLine}
            onChange={handleChangeAttribute}
          >
            {collection.map((option) => (
              <MenuItem
                id={option.key}
                key={option.key}
                value={`${option.key} = ${option.value}`}
              >
                {option.key} : {option.value}
              </MenuItem>
            ))}
          </Select>
          <DialogContentText>Key : {attributeKey}</DialogContentText>
          <TextField
            margin="dense"
            id="newvalue"
            type="text"
            fullWidth
            variant="outlined"
            value={attributeNewValue}
            onChange={(e) => handleChangeAttributeValue(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button variant="contained" type="submit">
            Submit
          </Button>
          <Button
            variant="outlined"
            type="submit"
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
