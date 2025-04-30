/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
} from '@apollo-annotation/mst'
import { MergeExonsChange } from '@apollo-annotation/shared'
import { AbstractSessionModel } from '@jbrowse/core/util'
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
  SelectChangeEvent,
} from '@mui/material'
import { getSnapshot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
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

function mergeExons(
  firstExon: AnnotationFeatureSnapshot,
  secondExon: AnnotationFeatureSnapshot,
): AnnotationFeatureSnapshot {
  const mergedExon = structuredClone(firstExon)
  mergedExon.min = Math.min(firstExon.min, secondExon.min)
  mergedExon.max = Math.max(firstExon.max, secondExon.max)
  mergedExon.attributes = mergeAttributes(firstExon, secondExon)
  return mergedExon
}

function mergeAttributes(
  firstExon: AnnotationFeatureSnapshot,
  secondExon: AnnotationFeatureSnapshot,
): Record<string, string[]> {
  let mergedAttrs: Record<string, string[]> = {}
  if (firstExon.attributes) {
    // eslint-disable-next-line unicorn/prefer-structured-clone, @typescript-eslint/no-unsafe-assignment
    mergedAttrs = JSON.parse(JSON.stringify(firstExon.attributes))
  }

  if (secondExon.attributes) {
    // eslint-disable-next-line unicorn/prefer-structured-clone, @typescript-eslint/no-unsafe-assignment
    const attrs: Record<string, string[]> = JSON.parse(
      JSON.stringify(secondExon.attributes),
    )
    for (const key of Object.keys(attrs)) {
      if (key === '_id' || key === 'gff_id') {
        continue
      }
      if (!Object.keys(mergedAttrs).includes(key)) {
        mergedAttrs[key] = []
      }
      attrs[key].map((x) => {
        if (!mergedAttrs[key].includes(x)) {
          mergedAttrs[key].push(x)
        }
      })
    }
  }
  return mergedAttrs
}

export function MergeExons({
  changeManager,
  handleClose,
  selectedFeature,
  session,
  setSelectedFeature,
  sourceAssemblyId,
  sourceFeature,
}: MergeExonsProps) {
  const { notify } = session as unknown as AbstractSessionModel
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedExon, setSelectedExon] = useState<AnnotationFeature>()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (!selectedExon) {
      return
    }
    if (selectedFeature?._id === sourceFeature._id) {
      setSelectedFeature()
    }
    const firstExon = getSnapshot(sourceFeature)
    const secondExon = getSnapshot(selectedExon)
    const change = new MergeExonsChange({
      changedIds: [sourceFeature._id],
      typeName: 'MergeExonsChange',
      assembly: sourceAssemblyId,
      firstExon,
      secondExon,
      parentFeatureId: sourceFeature.parent?._id,
      mergedExon: mergeExons(firstExon, secondExon),
    })
    await changeManager.submit(change)
    notify('Exons successfully merged', 'success')
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
