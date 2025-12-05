/* eslint-disable @typescript-eslint/unbound-method */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import { MergeTranscriptsChange } from '@apollo-annotation/shared'
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

function getTranscripts(
  referenceTranscript: AnnotationFeature,
  session: ApolloSessionModel,
): Record<string, AnnotationFeature> {
  const gene = referenceTranscript.parent
  if (!gene) {
    throw new Error('Unable to find parent of reference transcript')
  }

  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }

  const transcripts: Record<string, AnnotationFeature> = {}
  if (gene.children) {
    for (const [, feature] of gene.children) {
      if (
        featureTypeOntology.isTypeOf(feature.type, 'transcript') &&
        feature._id !== referenceTranscript._id
      ) {
        transcripts[feature._id] = feature
      }
    }
  }
  return transcripts
}

function makeRadioButtonName(transcript: AnnotationFeature): string {
  let id
  if (transcript.attributes.get('gff_name')) {
    id = transcript.attributes.get('gff_name')?.join(',')
  } else if (transcript.featureId) {
    id = transcript.featureId
  } else {
    id = transcript._id
  }
  return `${id} [${transcript.min + 1}-${transcript.max}]`
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
  const [errorMessage, setErrorMessage] = useState('')
  const transcripts = getTranscripts(sourceFeature, session)
  const firstTranscript = Object.keys(transcripts).at(0)
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<
    string | undefined
  >(firstTranscript)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (!selectedTranscriptId) {
      return
    }
    const selectedTranscript = transcripts[selectedTranscriptId]
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
    void changeManager.submit(change)
    handleClose()
  }

  const handleTypeChange = (e: SelectChangeEvent) => {
    setErrorMessage('')
    const { value } = e.target
    setSelectedTranscriptId(value)
  }

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
          {Object.keys(transcripts).length === 0
            ? 'There are no transcripts to merge with'
            : 'Merge with transcript:'}
          <FormControl style={{ marginTop: 5 }}>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              name="radio-buttons-group"
              value={selectedTranscriptId}
              onChange={handleTypeChange}
            >
              {Object.keys(transcripts).map((key) => (
                <FormControlLabel
                  value={key}
                  key={key}
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center">
                      {makeRadioButtonName(transcripts[key])}
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
              Object.keys(transcripts).length === 0 ||
              selectedTranscriptId === undefined
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
