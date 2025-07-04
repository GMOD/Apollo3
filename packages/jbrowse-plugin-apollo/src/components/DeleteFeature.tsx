/* eslint-disable @typescript-eslint/unbound-method */

import { type AnnotationFeature } from '@apollo-annotation/mst'
import { DeleteFeatureChange } from '@apollo-annotation/shared'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import { getSnapshot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { type ChangeManager } from '../ChangeManager'
import { type ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface DeleteFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
  selectedFeature?: AnnotationFeature
  setSelectedFeature(feature?: AnnotationFeature): void
}

export function DeleteFeature({
  changeManager,
  handleClose,
  selectedFeature,
  setSelectedFeature,
  sourceAssemblyId,
  sourceFeature,
}: DeleteFeatureProps) {
  const [errorMessage, setErrorMessage] = useState('')

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (selectedFeature?._id === sourceFeature._id) {
      setSelectedFeature()
    }

    // Delete features
    const change = new DeleteFeatureChange({
      changedIds: [sourceFeature._id],
      typeName: 'DeleteFeatureChange',
      assembly: sourceAssemblyId,
      deletedFeature: getSnapshot(sourceFeature),
      parentFeatureId: sourceFeature.parent?._id,
    })
    void changeManager.submit(change)
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog
      open
      title="Delete feature"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="delete-feature"
    >
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
          <Button variant="outlined" type="submit" onClick={handleClose}>
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
