/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  type AnnotationFeature,
  type AnnotationFeatureSnapshot,
} from '@apollo-annotation/mst'
import { SplitExonChange } from '@apollo-annotation/shared'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import ObjectID from 'bson-objectid'
import { getSnapshot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { type ChangeManager } from '../ChangeManager'
import { type ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface SplitExonProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
  selectedFeature?: AnnotationFeature
  setSelectedFeature(feature?: AnnotationFeature): void
}

interface splittableExon {
  isSplittable: boolean
  comment: string
}

function exonIsSplittable(
  exonToBeSplit: AnnotationFeatureSnapshot,
): splittableExon {
  if (exonToBeSplit.max - exonToBeSplit.min < 2) {
    return {
      isSplittable: false,
      comment: 'This exon is too short to be split',
    }
  }
  return { isSplittable: true, comment: '' }
}

function makeDialogText(splitExon: AnnotationFeatureSnapshot): string {
  const splittable = exonIsSplittable(splitExon)
  if (splittable.isSplittable) {
    return 'Are you sure you want to split the selected exon?'
  }
  return splittable.comment
}

export function SplitExon({
  changeManager,
  handleClose,
  selectedFeature,
  setSelectedFeature,
  sourceAssemblyId,
  sourceFeature,
}: SplitExonProps) {
  const [errorMessage, setErrorMessage] = useState('')

  const exonToBeSplit = getSnapshot(sourceFeature)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (selectedFeature?._id === sourceFeature._id) {
      setSelectedFeature()
    }

    const midpoint =
      exonToBeSplit.min + (exonToBeSplit.max - exonToBeSplit.min) / 2
    const upstreamCut = Math.floor(midpoint)
    const downstreamCut = Math.ceil(midpoint)

    if (!sourceFeature.parent?._id) {
      throw new Error('Splitting an exon without parent is not possible yet')
    }

    const change = new SplitExonChange({
      changedIds: [sourceFeature._id],
      typeName: 'SplitExonChange',
      assembly: sourceAssemblyId,
      exonToBeSplit,
      parentFeatureId: sourceFeature.parent._id,
      upstreamCut,
      downstreamCut,
      leftExonId: new ObjectID().toHexString(),
      rightExonId: new ObjectID().toHexString(),
    })
    void changeManager.submit(change)
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog
      open
      title="Split exon"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="split-exon"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>{makeDialogText(exonToBeSplit)}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            type="submit"
            disabled={!exonIsSplittable(exonToBeSplit).isSplittable}
          >
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
