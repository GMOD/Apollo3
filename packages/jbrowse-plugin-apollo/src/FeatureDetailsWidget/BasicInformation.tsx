import { AbstractSessionModel } from '@jbrowse/core/util'
import { TextField, Typography } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import {
  LocationEndChange,
  LocationStartChange,
  StrandChange,
  TypeChange,
} from 'apollo-shared'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

import { OntologyTermAutocomplete } from '../components/OntologyTermAutocomplete'
import { isOntologyClass } from '../OntologyManager'
import OntologyStore from '../OntologyManager/OntologyStore'
import { fetchValidDescendantTerms } from '../OntologyManager/util'
import { ApolloSessionModel } from '../session'

export const BasicInformation = observer(function BasicInformation({
  assembly,
  feature,
  session,
}: {
  feature: AnnotationFeatureI
  session: ApolloSessionModel
  assembly: string
}) {
  const [errorMessage, setErrorMessage] = useState('')
  const [typeWarningText, setTypeWarningText] = useState('')

  const { _id, assemblyId, end, start, strand, type } = feature

  const notifyError = (e: Error) =>
    (session as unknown as AbstractSessionModel).notify(e.message, 'error')

  const { changeManager } = session.apolloDataStore
  function handleTypeChange(newType: string) {
    setErrorMessage('')
    const featureId = _id
    const change = new TypeChange({
      typeName: 'TypeChange',
      changedIds: [featureId],
      featureId,
      oldType: type,
      newType,
      assembly: assemblyId,
    })
    return changeManager.submit(change)
  }

  function handleStrandChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { value } = event.target
    const newStrand = value ? (Number(value) as 1 | -1) : undefined
    const change = new StrandChange({
      typeName: 'StrandChange',
      changedIds: [_id],
      featureId: _id,
      oldStrand: strand,
      newStrand,
      assembly,
    })
    return changeManager.submit(change)
  }

  function handleStartChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { value } = event.target
    const newStart = Number(value) - 1
    const change = new LocationStartChange({
      typeName: 'LocationStartChange',
      changedIds: [_id],
      featureId: _id,
      oldStart: start,
      newStart,
      assembly,
    })
    return changeManager.submit(change)
  }

  function handleEndChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { value } = event.target
    const newEnd = Number(value)
    const change = new LocationEndChange({
      typeName: 'LocationEndChange',
      changedIds: [_id],
      featureId: _id,
      oldEnd: end,
      newEnd,
      assembly,
    })
    return changeManager.submit(change)
  }

  async function fetchValidTerms(
    parentFeature: AnnotationFeatureI | undefined,
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

  return (
    <>
      <Typography variant="h4">Basic information</Typography>
      <TextField
        margin="dense"
        id="start"
        label="Start"
        type="number"
        fullWidth
        variant="outlined"
        value={start + 1}
        onChange={handleStartChange}
      />
      <TextField
        margin="dense"
        id="end"
        label="End"
        type="number"
        fullWidth
        variant="outlined"
        value={end}
        onChange={handleEndChange}
      />
      <OntologyTermAutocomplete
        session={session}
        ontologyName="Sequence Ontology"
        value={type}
        filterTerms={isOntologyClass}
        fetchValidTerms={fetchValidTerms.bind(null, feature)}
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
            handleTypeChange(newValue).catch(notifyError)
          }
        }}
      />
      <label>
        <input
          type="radio"
          value="1"
          checked={strand === 1}
          onChange={handleStrandChange}
        />
        Positive Strand (+)
      </label>
      <label>
        <input
          type="radio"
          value="-1"
          checked={strand === -1}
          onChange={handleStrandChange}
        />
        Negative Strand (-)
      </label>
      <label>
        <input
          type="radio"
          value=""
          checked={strand === undefined}
          onChange={handleStrandChange}
        />
        No Strand Information
      </label>
      {errorMessage ? (
        <Typography color="error">{errorMessage}</Typography>
      ) : null}
    </>
  )
})
