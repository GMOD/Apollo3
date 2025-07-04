/* eslint-disable @typescript-eslint/unbound-method */

import { type AnnotationFeature } from '@apollo-annotation/mst'
import { AddFeatureChange } from '@apollo-annotation/shared'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  TextField,
} from '@mui/material'
import ObjectID from 'bson-objectid'
import React, { useState } from 'react'

import { type ChangeManager } from '../ChangeManager'
import { isOntologyClass } from '../OntologyManager'
import type OntologyStore from '../OntologyManager/OntologyStore'
import { fetchValidDescendantTerms } from '../OntologyManager/util'
import { type ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'
import { OntologyTermAutocomplete } from './OntologyTermAutocomplete'

interface AddChildFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
}

export function AddChildFeature({
  changeManager,
  handleClose,
  session,
  sourceAssemblyId,
  sourceFeature,
}: AddChildFeatureProps) {
  const [end, setEnd] = useState(String(sourceFeature.max))
  const [start, setStart] = useState(String(sourceFeature.min + 1))
  const [type, setType] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [typeWarningText, setTypeWarningText] = useState('')

  async function fetchValidTerms(
    parentFeature: AnnotationFeature | undefined,
    ontologyStore: OntologyStore,
    _signal: AbortSignal,
  ) {
    const terms = await fetchValidDescendantTerms(
      parentFeature,
      ontologyStore,
      _signal,
    )
    if (!terms) {
      setTypeWarningText(
        `Type "${parentFeature?.type}" does not have any children in the ontology`,
      )
      return
    }
    return terms
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const change = new AddFeatureChange({
      changedIds: [sourceFeature._id],
      typeName: 'AddFeatureChange',
      assembly: sourceAssemblyId,
      addedFeature: {
        _id: new ObjectID().toHexString(),
        refSeq: sourceFeature.refSeq,
        min: Number(start) - 1,
        max: Number(end),
        type,
      },
      parentFeatureId: sourceFeature._id,
    })
    void changeManager.submit(change)
    handleClose()
    event.preventDefault()
  }
  function handleChangeType(newType: string) {
    setErrorMessage('')
    setType(newType)
  }
  const error = Number(end) <= Number(start)
  return (
    <Dialog
      open
      title="Add new child feature"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="add-feature-dialog"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            margin="dense"
            id="start"
            label="Start"
            type="number"
            fullWidth
            variant="outlined"
            value={start}
            onChange={(e) => {
              setStart(e.target.value)
            }}
          />
          <TextField
            margin="dense"
            id="end"
            label="End"
            type="number"
            fullWidth
            variant="outlined"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value)
            }}
            error={error}
            helperText={error ? '"End" must be greater than "Start"' : null}
          />
          <OntologyTermAutocomplete
            session={session}
            ontologyName="Sequence Ontology"
            style={{ width: 170 }}
            value={type}
            filterTerms={isOntologyClass}
            fetchValidTerms={fetchValidTerms.bind(null, sourceFeature)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Type"
                variant="outlined"
                fullWidth
                error={Boolean(typeWarningText)}
                helperText={typeWarningText}
              />
            )}
            onChange={(oldValue, newValue) => {
              if (newValue) {
                handleChangeType(newValue)
              }
            }}
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
