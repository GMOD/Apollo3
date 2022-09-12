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
import { AnnotationFeatureI } from 'apollo-mst'
import { AddFeatureChange, ChangeManager } from 'apollo-shared'
import ObjectID from 'bson-objectid'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface AddFeatureProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceAssemblyId: string
  changeManager: ChangeManager
}

export function AddFeature({
  session,
  handleClose,
  sourceFeature,
  sourceAssemblyId,
  changeManager,
}: AddFeatureProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const { notify } = session
  const [end, setEnd] = useState(String(sourceFeature.end))
  const [start, setStart] = useState(String(sourceFeature.start))
  const [type, setType] = useState('')
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const [errorMessage, setErrorMessage] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const change = new AddFeatureChange({
      changedIds: [sourceFeature._id],
      typeName: 'AddFeatureChange',
      assemblyId: sourceAssemblyId,
      addedFeature: {
        _id: new ObjectID().toHexString(),
        refSeq: sourceFeature.refSeq,
        start: Number(start),
        end: Number(end),
        type,
      },
      parentFeatureId: sourceFeature._id,
    })
    changeManager.submit?.(change)
    notify(`Feature added successfully`, 'success')
    handleClose()
    event.preventDefault()
  }

  const error = Number(end) <= Number(start)
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
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <TextField
            margin="dense"
            id="end"
            label="End"
            type="number"
            fullWidth
            variant="outlined"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            error={error}
            helperText={error ? '"End" must be greater than "Start"' : null}
          />
          <TextField
            margin="dense"
            id="type"
            label="Type"
            type="text"
            fullWidth
            variant="outlined"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button
            variant="contained"
            type="submit"
            disabled={error || !(start && end && type)}
          >
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
