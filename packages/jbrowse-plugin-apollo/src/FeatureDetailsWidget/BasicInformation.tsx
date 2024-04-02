import { AbstractSessionModel } from '@jbrowse/core/util'
import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
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
import { NumberTextField } from './NumberTextField'

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

  function handleStartChange(newStart: number) {
    newStart--
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

  function handleEndChange(newEnd: number) {
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
      <NumberTextField
        margin="dense"
        id="start"
        label="Start"
        fullWidth
        variant="outlined"
        value={start + 1}
        onChangeCommitted={handleStartChange}
      />
      <NumberTextField
        margin="dense"
        id="end"
        label="End"
        fullWidth
        variant="outlined"
        value={end}
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
      <FormControl>
        <FormLabel>Strand</FormLabel>
        <RadioGroup row value={strand ?? ''} onChange={handleStrandChange}>
          <FormControlLabel value="1" control={<Radio />} label="Forward (+)" />
          <FormControlLabel
            value="-1"
            control={<Radio />}
            label="Reverse (-)"
          />
          <FormControlLabel value="" control={<Radio />} label="None" />
        </RadioGroup>
      </FormControl>
      {errorMessage ? (
        <Typography color="error">{errorMessage}</Typography>
      ) : null}
    </>
  )
})
