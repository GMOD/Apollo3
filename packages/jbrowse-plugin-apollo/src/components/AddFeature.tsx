import { AbstractSessionModel, Region } from '@jbrowse/core/util/types'
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
import { AddFeatureChange } from 'apollo-shared'
import ObjectID from 'bson-objectid'
import React, { useState } from 'react'

import { ChangeManager } from '../ChangeManager'
import { isOntologyClass } from '../OntologyManager'
import { ApolloSessionModel } from '../session'
import { Dialog } from './Dialog'
import { OntologyTermAutocomplete } from './OntologyTermAutocomplete'

interface AddFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  region: Region
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
  region,
  session,
}: AddFeatureProps) {
  const { notify } = session as unknown as AbstractSessionModel
  const [end, setEnd] = useState(String(region.end))
  const [start, setStart] = useState(String(region.start))
  const [type, setType] = useState('')
  const [phase, setPhase] = useState('')
  const [strand, setStrand] = useState<1 | -1 | undefined>()
  const [phaseAsNumber, setPhaseAsNumber] = useState<PhaseEnum>()
  const [showPhase, setShowPhase] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (showPhase && phase === '') {
      setErrorMessage('The phase is REQUIRED for all CDS features.')
      return
    }

    let refSeqId
    for (const [, asm] of session.apolloDataStore.assemblies ?? new Map()) {
      if (asm._id === region.assemblyName) {
        for (const [, refseq] of asm.refSeqs ?? new Map()) {
          if (refseq.name === region.refName) {
            refSeqId = refseq._id
          }
        }
      }
    }

    if (!refSeqId) {
      setErrorMessage('Invalid refseq id')
      return
    }

    const id = new ObjectID().toHexString()
    const change = new AddFeatureChange({
      changedIds: [id],
      typeName: 'AddFeatureChange',
      assembly: region.assemblyName,
      addedFeature: {
        _id: id,
        gffId: '',
        refSeq: refSeqId,
        start: Number(start),
        end: Number(end),
        type,
        phase: phaseAsNumber,
        strand,
      },
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

  function handleChangeStrand(e: SelectChangeEvent<string>) {
    setErrorMessage('')

    switch (Number(e.target.value)) {
      case 1: {
        setStrand(1)
        break
      }
      case -1: {
        setStrand(-1)
        break
      }
      default: {
        // eslint-disable-next-line unicorn/no-useless-undefined
        setStrand(undefined)
      }
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
      title="Add new feature"
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
            value={Number(start)+1}
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
          <OntologyTermAutocomplete
            session={session}
            ontologyName="Sequence Ontology"
            style={{ width: 170 }}
            value={type}
            filterTerms={isOntologyClass}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Type"
                variant="outlined"
                fullWidth
              />
            )}
            onChange={(oldValue, newValue) => {
              if (newValue) {
                handleChangeType(newValue)
              }
            }}
          />
          <FormControl>
            <InputLabel id="demo-simple-select-label">Strand</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              label="Strand"
              value={strand?.toString()}
              onChange={handleChangeStrand}
            >
              <MenuItem value={undefined}></MenuItem>
              <MenuItem value={1}>+</MenuItem>
              <MenuItem value={-1}>-</MenuItem>
            </Select>
          </FormControl>
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
