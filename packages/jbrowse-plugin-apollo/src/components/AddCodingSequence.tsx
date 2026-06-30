/* eslint-disable @typescript-eslint/unbound-method */
import type {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
} from '@apollo-annotation/mst'
import { AddFeatureChange } from '@apollo-annotation/shared'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import { revcom } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import ObjectID from 'bson-objectid'
import React, { useState } from 'react'

import type { ChangeManager } from '../ChangeManager'
import type { ApolloSessionModel } from '../session'
import { findLongestOrf } from '../util/sequenceUtils'

import { Dialog } from './Dialog'

interface AddCodingSequenceProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
  refName: string
}

// Returns the genomic half-open boundary for stitched position `pos`.
// For strand +1: the inclusive start (min) of the nucleotide.
// For strand -1: the exclusive end (max) of the nucleotide.
// Symmetric usage:
//   plus:  cdsMin = helper(orf[0]), cdsMax = helper(orf[1]+3)
//   minus: cdsMax = helper(orf[0]), cdsMin = helper(orf[1]+3)
function stitchedToGenomicBound(
  pos: number,
  exons: { min: number; max: number }[],
  strand: 1 | -1,
): number {
  let cum = 0
  for (const exon of exons) {
    const len = exon.max - exon.min
    if (pos <= cum + len) {
      const off = pos - cum
      return strand === 1 ? exon.min + off : exon.max - off
    }
    cum += len
  }
  const last = exons.at(-1)
  if (!last) {
    throw new Error('No exons found')
  }
  return strand === 1 ? last.max : last.min
}

export function AddCodingSequence({
  changeManager,
  handleClose,
  refName,
  session,
  sourceAssemblyId,
  sourceFeature,
}: AddCodingSequenceProps) {
  const [method, setMethod] = useState<'longest-orf' | 'manual'>('longest-orf')
  const [minInput, setMinInput] = useState('')
  const [maxInput, setMaxInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    let cdsMin: number
    let cdsMax: number

    try {
      if (method === 'longest-orf') {
        const exonParts = sourceFeature.transcriptExonParts.filter(
          (p) => p.type === 'exon',
        )
        if (exonParts.length === 0) {
          setErrorMessage('No exons found in this transcript')
          return
        }

        const backendDriver =
          session.apolloDataStore.getBackendDriver(sourceAssemblyId)
        if (!backendDriver) {
          setErrorMessage('No backend driver found for this assembly')
          return
        }

        let stitchedSequence = ''
        for (const exon of exonParts) {
          const { seq } = await backendDriver.getSequence({
            assemblyName: sourceAssemblyId,
            refName,
            start: exon.min,
            end: exon.max,
          })
          stitchedSequence += sourceFeature.strand === -1 ? revcom(seq) : seq
        }

        const orf = findLongestOrf(stitchedSequence)
        if (!orf) {
          ;(session as unknown as AbstractSessionModel).notify(
            'No open reading frame found in this transcript',
            'error',
          )
          handleClose()
          return
        }

        const strand = sourceFeature.strand ?? 1
        if (strand === 1) {
          cdsMin = stitchedToGenomicBound(orf[0], exonParts, 1)
          cdsMax = stitchedToGenomicBound(orf[1] + 3, exonParts, 1)
        } else {
          cdsMax = stitchedToGenomicBound(orf[0], exonParts, -1)
          cdsMin = stitchedToGenomicBound(orf[1] + 3, exonParts, -1)
        }
      } else {
        cdsMin = Number(minInput) - 1
        cdsMax = Number(maxInput)
      }

      const _id = new ObjectID().toHexString()
      const addedFeature: AnnotationFeatureSnapshot = {
        _id,
        refSeq: sourceFeature.refSeq,
        min: cdsMin,
        max: cdsMax,
        type: 'CDS',
      }
      if (sourceFeature.strand) {
        addedFeature.strand = sourceFeature.strand
      }
      const change = new AddFeatureChange({
        changedIds: [sourceFeature._id],
        typeName: 'AddFeatureChange',
        assembly: sourceAssemblyId,
        addedFeature,
        parentFeatureId: sourceFeature._id,
      })
      await changeManager.submit(change)
      session.apolloSetSelectedFeature(_id)
      handleClose()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'An unknown error occurred',
      )
    }
  }

  const manualError =
    method === 'manual' &&
    Boolean(minInput) &&
    Boolean(maxInput) &&
    Number(maxInput) <= Number(minInput)

  const submitDisabled =
    method === 'manual' ? !(minInput && maxInput) || manualError : false

  return (
    <Dialog
      open
      title="Add coding sequence"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="add-coding-sequence"
    >
      <form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
      >
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <FormControl>
            <RadioGroup
              value={method}
              onChange={(e) => {
                setMethod(e.target.value as 'longest-orf' | 'manual')
              }}
            >
              <FormControlLabel
                value="longest-orf"
                control={<Radio />}
                label="Calculate longest open reading frame"
              />
              <FormControlLabel
                value="manual"
                control={<Radio />}
                label="Manual"
              />
            </RadioGroup>
          </FormControl>
          {method === 'manual' ? (
            <>
              <TextField
                margin="dense"
                id="cds-min"
                label="Min"
                type="number"
                fullWidth
                variant="outlined"
                value={minInput}
                onChange={(e) => {
                  setMinInput(e.target.value)
                }}
              />
              <TextField
                margin="dense"
                id="cds-max"
                label="Max"
                type="number"
                fullWidth
                variant="outlined"
                value={maxInput}
                onChange={(e) => {
                  setMaxInput(e.target.value)
                }}
                error={manualError}
                helperText={
                  manualError ? '"Max" must be greater than "Min"' : null
                }
              />
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" type="submit" disabled={submitDisabled}>
            Submit
          </Button>
          <Button variant="outlined" type="button" onClick={handleClose}>
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
