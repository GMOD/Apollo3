import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  // SelectChangeEvent,
} from '@mui/material'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface DeleteFeatureProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeatureId: string
  sourceAssemblyId: string
}

// interface Collection {
//   _id: string
//   name: string
// }

export function DeleteFeature({
  session,
  handleClose,
  sourceFeatureId,
  sourceAssemblyId,
}: DeleteFeatureProps) {
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


  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    let msg

    // Add features
    const uri = new URL('changes', baseURL).href
    const apolloFetch = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetch) {
      const res = await apolloFetch(uri, {
        method: 'POST',
        body: JSON.stringify({
          changedIds: ['1'],
          typeName: 'DeleteFeatureChange',
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
          `Error when deleting feature — ${res.status} (${res.statusText})${
            msg ? ` (${msg})` : ''
          }`,
        )
        return
      }
    }
    notify(`Feature deleted successfully`, 'success')
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Delete feature</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>
            Are you sure you want to delete the selected feature?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" type="submit">
            Yes
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
