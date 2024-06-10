/* eslint-disable @typescript-eslint/no-misused-promises */
import { AnnotationFeatureI } from '@apollo-annotation/mst'
import { AddFeatureChange } from '@apollo-annotation/shared'
import { AbstractSessionModel } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
} from '@mui/material'
import ObjectID from 'bson-objectid'
import React, { useState } from 'react'

import { ChangeManager } from '../ChangeManager'
import { isOntologyClass } from '../OntologyManager'
import OntologyStore from '../OntologyManager/OntologyStore'
import { fetchValidDescendantTerms } from '../OntologyManager/util'
import { ApolloSessionModel } from '../session'
import { Dialog } from './Dialog'
import { OntologyTermAutocomplete } from './OntologyTermAutocomplete'

interface AddChildFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceAssemblyId: string
  changeManager: ChangeManager
}

enum PhaseEnum {
  zero = 0,
  one = 1,
  two = 2,
}

export function AddChildFeature({
  changeManager,
  handleClose,
  session,
  sourceAssemblyId,
  sourceFeature,
}: AddChildFeatureProps) {
  const { notify } = session as unknown as AbstractSessionModel
  const [end, setEnd] = useState(String(sourceFeature.end))
  const [start, setStart] = useState(String(sourceFeature.start + 1))
  const [type, setType] = useState('')
  const [phase, setPhase] = useState('')
  const [phaseAsNumber, setPhaseAsNumber] = useState<PhaseEnum>()
  const [showPhase, setShowPhase] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [typeWarningText, setTypeWarningText] = useState('')

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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (showPhase && phase === '') {
      setErrorMessage('The phase is REQUIRED for all CDS features.')
      return
    }
    const change = new AddFeatureChange({
      changedIds: [sourceFeature._id],
      typeName: 'AddFeatureChange',
      assembly: sourceAssemblyId,
      addedFeature: {
        _id: new ObjectID().toHexString(),
        gffId: '',
        refSeq: sourceFeature.refSeq,
        start: Number(start) - 1,
        end: Number(end),
        type,
        phase: phaseAsNumber,
      },
      parentFeatureId: sourceFeature._id,
    })
    await changeManager.submit(change)
    notify('Feature added successfully', 'success')
    handleClose()
    event.preventDefault()
  }
  function handleChangeType(newType: string) {
    setErrorMessage('')
    setType(newType)
    if (newType.startsWith('CDS')) {
      setShowPhase(true)
      setPhase('')
    } else {
      setShowPhase(false)
    }
  }
  function handleChangePhase(e: SelectChangeEvent) {
    setErrorMessage('')
    setPhase(e.target.value)

    switch (Number(e.target.value)) {
      case 0: {
        setPhaseAsNumber(PhaseEnum.zero)
        break
      }
      case 1: {
        setPhaseAsNumber(PhaseEnum.one)
        break
      }
      case 2: {
        setPhaseAsNumber(PhaseEnum.two)
        break
      }
      default: {
        // eslint-disable-next-line unicorn/no-useless-undefined
        setPhaseAsNumber(undefined)
      }
    }
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
          {/* <Select value={type} onChange={handleChangeType} label="Type">
              {(possibleChildTypes ?? []).map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select> */}
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
          {showPhase ? (
            <FormControl>
              <InputLabel>Phase</InputLabel>
              <Select value={phase} onChange={handleChangePhase}>
                <MenuItem value={0}>0</MenuItem>
                <MenuItem value={1}>1</MenuItem>
                <MenuItem value={2}>2</MenuItem>
              </Select>
            </FormControl>
          ) : null}
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
