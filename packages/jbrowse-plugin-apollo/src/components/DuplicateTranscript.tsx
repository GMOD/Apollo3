/* eslint-disable @typescript-eslint/unbound-method */
import {
  type AnnotationFeature,
  type AnnotationFeatureSnapshot,
} from '@apollo-annotation/mst'
import { AddFeatureChange } from '@apollo-annotation/shared'
import { type AbstractSessionModel } from '@jbrowse/core/util/types'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import ObjectID from 'bson-objectid'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import React, { useState } from 'react'

import { type ChangeManager } from '../ChangeManager'
import { type ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface DuplicateTranscriptProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
  selectedFeature?: AnnotationFeature
  setSelectedFeature(feature?: AnnotationFeature): void
}

export function DuplicateTranscript({
  changeManager,
  handleClose,
  session,
  sourceAssemblyId,
  sourceFeature,
  setSelectedFeature,
}: DuplicateTranscriptProps) {
  const [errorMessage, setErrorMessage] = useState('')
  const { notify } = session as unknown as AbstractSessionModel

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    try {
      const parentGene = sourceFeature.parent
      if (!parentGene) {
        setErrorMessage('No parent gene found for this transcript')
        return
      }

      const transcriptSnapshot = getSnapshot(sourceFeature)
      const newTranscriptId = new ObjectID().toHexString()
      const duplicateTranscript = {
        ...transcriptSnapshot,
        _id: newTranscriptId,
      } as AnnotationFeatureSnapshot

      if (duplicateTranscript.children) {
        const newChildren: Record<string, AnnotationFeatureSnapshot> = {}
        for (const [, child] of Object.entries(duplicateTranscript.children)) {
          const newChildId = new ObjectID().toHexString()
          newChildren[newChildId] = {
            ...child,
            _id: newChildId,
          } as AnnotationFeatureSnapshot
        }
        duplicateTranscript.children = newChildren
      }

      const change = new AddFeatureChange({
        parentFeatureId: parentGene._id,
        changedIds: [parentGene._id],
        typeName: 'AddFeatureChange',
        assembly: sourceAssemblyId,
        addedFeature: duplicateTranscript,
      })

      await changeManager.submit(change).then(() => {
        setSelectedFeature(undefined)
        session.apolloSetSelectedFeature(newTranscriptId)
        notify('Successfully duplicated transcript', 'success')
      })

      handleClose()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to duplicate transcript',
      )
    }
  }

  return (
    <Dialog
      open
      title="Duplicate transcript"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="duplicate-transcript"
    >
      <form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
      >
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>
            Are you sure you want to create a duplicate of this transcript?
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
