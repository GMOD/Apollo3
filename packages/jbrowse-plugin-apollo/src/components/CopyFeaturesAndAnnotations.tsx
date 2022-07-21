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
} from '@material-ui/core'
import { getRoot } from 'mobx-state-tree'
import { model } from 'mobx-state-tree/dist/internal'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface CopyFeaturesAndAnnotationsProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeatureId: any
  sourceAssemblyId: any
}

interface Collection {
  _id: string
  name: string
}

export function CopyFeaturesAndAnnotations({
  session,
  handleClose,
  sourceFeatureId,
  sourceAssemblyId,
}: CopyFeaturesAndAnnotationsProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const { notify } = session
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [assemblyName, setAssemblyName] = useState('')
  const [collection, setCollection] = useState<Collection[]>([])
  const [assemblyId, setAssemblyId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  function handleChangeAssembly(
    e: React.ChangeEvent<{
      name?: string | undefined
      value: unknown
    }>,
  ) {
    setAssemblyId(e.target.value as string)
    setAssemblyName(
      collection.find((i) => i._id === e.target.value)?.name as string,
    )
  }

  useEffect(() => {
    async function getAssemblies() {
      const uri = new URL('/assemblies', baseURL).href
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
            `Error when copying features — ${response.status} (${
              response.statusText
            })${msg ? ` (${msg})` : ''}`,
          )
          return
        }
        const data = await response.json()
        data.forEach((item: Collection) => {
          // Do not show source assembly in the list of target assemblies
          if (item._id !== sourceAssemblyId) {
            setCollection((result) => [
              ...result,
              {
                _id: item._id,
                name: item.name,
              },
            ])
          }
        })
      }
    }
    console.log(`Source assembly "${sourceAssemblyId}" and source feature "${sourceFeatureId}"`)
    getAssemblies()
    return () => {
      setCollection([{ _id: '', name: '' }])
    }
  }, [apolloInternetAccount, baseURL, sourceAssemblyId, sourceFeatureId])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    let msg

    // Add features
    const uri = new URL('/changes/submitChange', baseURL).href
    const apolloFetch = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetch) {
      const res = await apolloFetch(uri, {
        method: 'POST',
        body: JSON.stringify({
          changedIds: ['1'],
          typeName: 'CopyFeaturesAndAnnotationsChange',
          assemblyId: sourceAssemblyId,
          featureId: sourceFeatureId,
          targetAssemblyId: assemblyId,
        }),
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      })
      if (!res.ok) {
        try {
          msg = await res.text()
        } catch (e) {
          msg = ''
        }
        setErrorMessage(
          `Error when copying features — ${res.status} (${res.statusText})${
            msg ? ` (${msg})` : ''
          }`,
        )
        return
      }
    }
    notify(
      `Features copied to assembly "${assemblyName}" successfully`,
      'success',
    )
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Copy features and annotations</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Target assembly</DialogContentText>
          <Select
            labelId="label"
            value={assemblyId}
            onChange={handleChangeAssembly}
          >
            {collection.map((option) => (
              <MenuItem key={option._id} value={option._id}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button disabled={!assemblyId} variant="contained" type="submit">
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
