/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import { MergeTranscriptsChange } from '@apollo-annotation/shared'
import { type AbstractSessionModel } from '@jbrowse/core/util'
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  type SelectChangeEvent,
} from '@mui/material'
import { getSnapshot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { type ChangeManager } from '../ChangeManager'
import { type ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface MergeTranscriptsProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
  selectedFeature?: AnnotationFeature
  setSelectedFeature(feature?: AnnotationFeature): void
}

function getNeighboringTranscripts(
  referenceTranscript: AnnotationFeature,
): Record<string, AnnotationFeature> {
  const neighboringTranscripts: Record<string, AnnotationFeature> = {}
  const tx = referenceTranscript.parent
  if (!tx) {
    throw new Error('Unable to find parent of reference transcript')
  }
  let transcripts: AnnotationFeature[] = []
  if (tx.children) {
    for (const [, feature] of tx.children) {
      if (feature.type === 'transcript') {
        transcripts.push(feature)
      }
    }
  }
  transcripts = transcripts.sort((a, b) => {
    if (a.min === b.min) {
      return a.max - b.max
    }
    return a.min - b.min
  })
  if (tx.strand && tx.strand === -1) {
    transcripts = transcripts.reverse()
  }
  let i = 0
  for (const x of transcripts) {
    if (x._id === referenceTranscript._id) {
      if (transcripts.length > i + 1) {
        neighboringTranscripts.three_prime = transcripts[i + 1]
      }
      if (i > 0) {
        neighboringTranscripts.five_prime = transcripts[i - 1]
      }
      break
    }
    i++
  }
  return neighboringTranscripts
}

function makeRadioButtonName(
  key: string,
  neighboringTranscripts: Record<string, AnnotationFeature>,
): string {
  const neighboringTranscript = neighboringTranscripts[key]
  let name
  if (key === 'three_prime') {
    name = `3'end (coords: ${neighboringTranscript.min + 1}-${neighboringTranscript.max})`
  } else if (key === 'five_prime') {
    name = `5'end (coords: ${neighboringTranscript.min + 1}-${neighboringTranscript.max})`
  } else {
    throw new Error(`Unexpected direction: "${key}"`)
  }
  return name
}

export function MergeTranscripts({
  changeManager,
  handleClose,
  selectedFeature,
  session,
  setSelectedFeature,
  sourceAssemblyId,
  sourceFeature,
}: MergeTranscriptsProps) {
  const { notify } = session as unknown as AbstractSessionModel
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedTranscript, setSelectedTranscript] =
    useState<AnnotationFeature>()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (!selectedTranscript) {
      return
    }
    if (selectedFeature?._id === sourceFeature._id) {
      setSelectedFeature()
    }

    if (!sourceFeature.parent) {
      throw new Error('Cannot find parent')
    }

    const change = new MergeTranscriptsChange({
      changedIds: [sourceFeature._id],
      typeName: 'MergeTranscriptsChange',
      assembly: sourceAssemblyId,
      firstTranscript: getSnapshot(sourceFeature),
      secondTranscript: getSnapshot(selectedTranscript),
      parentFeatureId: sourceFeature.parent._id,
    })
    await changeManager.submit(change)
    notify('Transcripts successfully merged', 'success')
    handleClose()
    event.preventDefault()
  }

  const handleTypeChange = (e: SelectChangeEvent) => {
    setErrorMessage('')
    const { value } = e.target
    setSelectedTranscript(neighboringTranscripts[value])
  }

  const neighboringTranscripts = getNeighboringTranscripts(sourceFeature)

  return (
    <Dialog
      open
      title="Merge transcripts"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="merge-transcripts"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          {Object.keys(neighboringTranscripts).length === 0
            ? 'There are no neighbouring transcripts to merge with'
            : 'Merge with transcript on:'}
          <FormControl style={{ marginTop: 5 }}>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              name="radio-buttons-group"
              value={selectedTranscript}
              onChange={handleTypeChange}
            >
              {Object.keys(neighboringTranscripts).map((key) => (
                <FormControlLabel
                  value={key}
                  key={key}
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center">
                      {makeRadioButtonName(key, neighboringTranscripts)}
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>
        </DialogContent>

        <DialogActions>
          <Button
            variant="contained"
            type="submit"
            disabled={
              Object.keys(neighboringTranscripts).length === 0 ||
              selectedTranscript === undefined
            }
          >
            Submit
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
