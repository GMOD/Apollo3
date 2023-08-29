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
import { AnnotationFeatureI } from 'apollo-mst'
import { AddFeatureChange } from 'apollo-shared'
import ObjectID from 'bson-objectid'
import React, { useState } from 'react'

import { ChangeManager } from '../ChangeManager'
import { isOntologyClass } from '../OntologyManager'
import OntologyStore from '../OntologyManager/OntologyStore'
import { Dialog } from './Dialog'
import { OntologyTermAutocomplete } from './OntologyTermAutocomplete'

interface AddFeatureProps {
  session: AbstractSessionModel
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

export function AddFeature({
  changeManager,
  handleClose,
  session,
  sourceAssemblyId,
  sourceFeature,
}: AddFeatureProps) {
  const { notify } = session
  const [end, setEnd] = useState(String(sourceFeature.end))
  const [start, setStart] = useState(String(sourceFeature.start))
  const [type, setType] = useState('')
  const [phase, setPhase] = useState('')
  const [phaseAsNumber, setPhaseAsNumber] = useState<PhaseEnum>()
  const [showPhase, setShowPhase] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [typeWarningText, setTypeWarningText] = useState('')

  async function fetchValidDescendantTerms(
    parentFeature: AnnotationFeatureI | undefined,
    ontologyStore: OntologyStore,
    _signal: AbortSignal,
  ) {
    if (!parentFeature) {
      return
    }
    // since this is a child of an existing feature, restrict the autocomplete choices to valid
    // parts of that feature
    const parentTypeTerms = await ontologyStore.getTermsWithLabelOrSynonym(
      parentFeature.type,
      { includeSubclasses: false },
    )
    // eslint-disable-next-line unicorn/no-array-callback-reference
    const parentTypeClassTerms = parentTypeTerms.filter(isOntologyClass)
    if (parentTypeTerms.length === 0) {
      return
    }
    const subpartTerms = await ontologyStore.getClassesThat(
      'part_of',
      parentTypeClassTerms,
    )
    if (subpartTerms.length > 0) {
      setTypeWarningText('')
    } else {
      setTypeWarningText(
        `Type "${parentFeature.type}" does not have any children in the ontology`,
      )
    }
    return subpartTerms
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
        start: Number(start),
        end: Number(end),
        type,
        phase: phaseAsNumber,
      },
      parentFeatureId: sourceFeature._id,
    })
    await changeManager.submit?.(change)
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
  async function handleChangePhase(e: SelectChangeEvent<string>) {
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
            onChange={(e) => setStart(e.target.value)}
          />
          <TextField
            margin="dense"
            id="end"
            label="End"
            type="number"
            fullWidth
            variant="outlined"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
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
            fetchValidTerms={fetchValidDescendantTerms.bind(
              null,
              sourceFeature,
            )}
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
