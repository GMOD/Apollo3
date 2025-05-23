/* eslint-disable @typescript-eslint/no-misused-promises */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
  StrandChange,
  TypeChange,
} from '@apollo-annotation/shared'
import { type AbstractSessionModel } from '@jbrowse/core/util'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

import { isOntologyClass } from '../OntologyManager'
import type OntologyStore from '../OntologyManager/OntologyStore'
import { fetchValidDescendantTerms } from '../OntologyManager/util'
import { OntologyTermAutocomplete } from '../components/OntologyTermAutocomplete'
import { type ApolloSessionModel } from '../session'

import { NumberTextField } from './NumberTextField'

export const BasicInformation = observer(function BasicInformation({
  assembly,
  feature,
  session,
}: {
  feature: AnnotationFeature
  session: ApolloSessionModel
  assembly: string
}) {
  const [errorMessage, setErrorMessage] = useState('')
  const [typeWarningText, setTypeWarningText] = useState('')

  const { _id, assemblyId, max, min, strand, type } = feature

  const notifyError = (e: Error) => {
    ;(session as unknown as AbstractSessionModel).notify(e.message, 'error')
  }

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

  function handleStartChange(newStart: number) {
    newStart--
    const change = new LocationStartChange({
      typeName: 'LocationStartChange',
      changedIds: [_id],
      featureId: _id,
      oldStart: min,
      newStart,
      assembly,
    })
    return changeManager.submit(change)
  }

  function handleEndChange(newEnd: number) {
    const change = new LocationEndChange({
      typeName: 'LocationEndChange',
      changedIds: [_id],
      featureId: _id,
      oldEnd: max,
      newEnd,
      assembly,
    })
    return changeManager.submit(change)
  }

  async function fetchValidTerms(
    parentFeature: undefined | AnnotationFeature,
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
    <div data-testid="basic_information">
      <NumberTextField
        margin="dense"
        id="start"
        label="Start"
        fullWidth
        variant="outlined"
        value={min + 1}
        onChangeCommitted={handleStartChange}
      />
      <NumberTextField
        margin="dense"
        id="end"
        label="End"
        fullWidth
        variant="outlined"
        value={max}
        onChangeCommitted={handleEndChange}
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
    </div>
  )
})
