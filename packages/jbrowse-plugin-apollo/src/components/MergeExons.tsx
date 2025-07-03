/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import { MergeExonsChange } from '@apollo-annotation/shared'
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

interface MergeExonsProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
  selectedFeature?: AnnotationFeature
  setSelectedFeature(feature?: AnnotationFeature): void
}

function getNeighboringExons(
  referenceExon: AnnotationFeature,
): Record<string, AnnotationFeature> {
  const neighboringExons: Record<string, AnnotationFeature> = {}
  const tx = referenceExon.parent
  if (!tx) {
    throw new Error('Unable to find parent of reference exon')
  }
  let exons: AnnotationFeature[] = []
  if (tx.children) {
    for (const [, feature] of tx.children) {
      if (feature.type === 'exon') {
        exons.push(feature)
      }
    }
  }
  exons = exons.sort((a, b) => {
    if (a.min === b.min) {
      return a.max - b.max
    }
    return a.min - b.min
  })
  if (tx.strand && tx.strand === -1) {
    exons = exons.reverse()
  }
  let i = 0
  for (const x of exons) {
    if (x._id === referenceExon._id) {
      if (exons.length > i + 1) {
        neighboringExons.three_prime = exons[i + 1]
      }
      if (i > 0) {
        neighboringExons.five_prime = exons[i - 1]
      }
      break
    }
    i++
  }
  return neighboringExons
}

function makeRadioButtonName(
  key: string,
  neighboringExons: Record<string, AnnotationFeature>,
): string {
  const neighboringExon = neighboringExons[key]
  let name
  if (key === 'three_prime') {
    name = `3'end (coords: ${neighboringExon.min + 1}-${neighboringExon.max})`
  } else if (key === 'five_prime') {
    name = `5'end (coords: ${neighboringExon.min + 1}-${neighboringExon.max})`
  } else {
    throw new Error(`Unexpected direction: "${key}"`)
  }
  return name
}

export function MergeExons({
  changeManager,
  handleClose,
  selectedFeature,
  setSelectedFeature,
  sourceAssemblyId,
  sourceFeature,
}: MergeExonsProps) {
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedExon, setSelectedExon] = useState<AnnotationFeature>()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const { parent } = sourceFeature
    if (!(selectedExon && parent)) {
      return
    }
    if (selectedFeature?._id === sourceFeature._id) {
      setSelectedFeature()
    }
    const change = new MergeExonsChange({
      changedIds: [sourceFeature._id],
      typeName: 'MergeExonsChange',
      assembly: sourceAssemblyId,
      firstExon: getSnapshot(sourceFeature),
      secondExon: getSnapshot(selectedExon),
      parentFeatureId: parent._id,
    })
    void changeManager.submit(change)
    handleClose()
    event.preventDefault()
  }

  const handleTypeChange = (e: SelectChangeEvent) => {
    setErrorMessage('')
    const { value } = e.target
    setSelectedExon(neighboringExons[value])
  }

  const neighboringExons = getNeighboringExons(sourceFeature)

  return (
    <Dialog
      open
      title="Merge exons"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="merge-exons"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          {Object.keys(neighboringExons).length === 0
            ? 'There are no neighbouring exons to merge with'
            : 'Merge with exon on:'}
          <FormControl style={{ marginTop: 5 }}>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              name="radio-buttons-group"
              value={selectedExon}
              onChange={handleTypeChange}
            >
              {Object.keys(neighboringExons).map((key) => (
                <FormControlLabel
                  value={key}
                  key={key}
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center">
                      {makeRadioButtonName(key, neighboringExons)}
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
              Object.keys(neighboringExons).length === 0 ||
              selectedExon === undefined
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
