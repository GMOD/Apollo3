import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface AddFeatureProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeatureId: string
  sourceAssemblyId: string
}

export function AddFeature({
  session,
  handleClose,
  sourceFeatureId,
  sourceAssemblyId,
}: AddFeatureProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const { notify } = session
  const [end, setEnd] = useState('')
  const [start, setStart] = useState('')
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [errorMessage, setErrorMessage] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    let msg

      console.log(`FEAT: ${sourceFeatureId}`)
      // Get feature's parent information
    const uri = new URL(`features/${sourceFeatureId}`, baseURL).href
    const apolloFetch = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetch) {
      const res = await apolloFetch(uri, {
        method: 'GET',
      })
      if (!res.ok) {
        try {
          msg = await res.text()
        } catch (e) {
          msg = ''
        }
        setErrorMessage(
          `Error when adding feature — ${res.status} (${res.statusText})${
            msg ? ` (${msg})` : ''
          }`,
        )
        return
      }
      const data = await res.json()
      console.log(`DATA: ${JSON.stringify(data)}`)
      console.log(`SEQ_ID: ${data.seq_id}`)
    }
    // Add new feature - remember also update list of featureIds in parent level
    if (apolloFetch) {
      const res = await apolloFetch(uri, {
        method: 'POST',
        body: JSON.stringify({
          changedIds: ['1'],
          typeName: 'AddFeatureChange',
          assemblyId: sourceAssemblyId,
          featureId: sourceFeatureId,
        }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      })
      if (!res.ok) {
        try {
          msg = await res.text()
        } catch (e) {
          msg = ''
        }
        setErrorMessage(
          `Error when adding feature — ${res.status} (${res.statusText})${
            msg ? ` (${msg})` : ''
          }`,
        )
        return
      }
    }
    notify(`Feature added successfully`, 'success')
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Add new feature</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            autoFocus
            margin="dense"
            id="start"
            label="Start"
            type="number"
            fullWidth
            variant="outlined"
            onChange={(e) => setStart(e.target.value)}
          />
          <TextField
            margin="dense"
            id="end"
            label="End"
            type="number"
            fullWidth
            variant="outlined"
            onChange={(e) => setEnd(e.target.value)}
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
