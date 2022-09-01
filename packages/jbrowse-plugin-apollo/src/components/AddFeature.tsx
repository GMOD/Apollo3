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
import { AddFeatureChange, ChangeManager } from 'apollo-shared'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface AddFeatureProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeatureId: string
  sourceAssemblyId: string
  changeManager: ChangeManager
}

export function AddFeature({
  session,
  handleClose,
  sourceFeatureId,
  sourceAssemblyId,
  changeManager,
}: AddFeatureProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const { notify } = session
  const [end, setEnd] = useState('')
  const [start, setStart] = useState('')
  const [type, setType] = useState('')
  const [paramName, setName] = useState('')
  const [paramId, setId] = useState('')
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
    let seqId = ''
    let parName = ''
    let parId = ''
    let parParentId = ''

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
      seqId = data.seq_id
      // console.log(`DATA: ${JSON.stringify(data)}`)
      if (data.attributes.ID) {
        parParentId = `Parent=${data.attributes.ID}`
      }
    }

    if (paramName) {
      parName = `Name=${paramName}`
    }
    if (paramId) {
      parId = `ID=${paramId}`
    }

    const change = new AddFeatureChange({
      changedIds: [sourceFeatureId],
      typeName: 'AddFeatureChange',
      assemblyId: sourceAssemblyId,
      // stringOfGFF3: `${seqId}\t\t${type}\t${start}\t${end}\t.\t.\t.\t${parParentId};${parName};${parId}`,
      stringOfGFF3: `${seqId}\t\t${type}\t${start}\t${end}\t.\t.\t.\t${parName};`,
      parentFeatureId: '',
    })
    console.log('Change:', { change })
    changeManager.submit?.(change)
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
          <TextField
            margin="dense"
            id="type"
            label="Type"
            type="text"
            fullWidth
            variant="outlined"
            onChange={(e) => setType(e.target.value)}
          />
          <TextField
            margin="dense"
            id="paramName"
            label="Attribute: Name"
            type="text"
            fullWidth
            variant="outlined"
            onChange={(e) => setName(e.target.value)}
          />
          {/* <TextField
            margin="dense"
            id="paramId"
            label="Attribute: ID"
            type="text"
            fullWidth
            variant="outlined"
            onChange={(e) => setId(e.target.value)}
          /> */}
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
