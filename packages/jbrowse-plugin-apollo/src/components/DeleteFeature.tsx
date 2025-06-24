/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import { DeleteFeatureChange } from '@apollo-annotation/shared'
import { type AbstractSessionModel } from '@jbrowse/core/util'
import { ConstructionOutlined } from '@mui/icons-material'
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
import React, { useEffect, useState } from 'react'

import { type ChangeManager } from '../ChangeManager'
import { type MousePosition } from '../LinearApolloDisplay/stateModel/mouseEvents'
import { type ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface DeleteFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
  selectedFeature?: AnnotationFeature
  setSelectedFeature(feature?: AnnotationFeature): void
}

function getChildren(
  feature: AnnotationFeature,
): Record<string, AnnotationFeature> {
  const children: Record<string, AnnotationFeature> = {}
  if (feature.children) {
    for (const [key, ff] of feature.children) {
      children[key] = ff
    }
  }
  return children
}

function getParents(
  feature: AnnotationFeature,
): Record<string, AnnotationFeature> {
  const parents: Record<string, AnnotationFeature> = {}
  let { parent } = feature
  while (parent) {
    parents[parent._id] = parent
    parent = parent.parent
  }
  return parents
}

function makeRadioButtonName(feature: AnnotationFeature): string {
  let id
  if (feature.attributes.get('gff_name')) {
    id = feature.attributes.get('gff_name')?.join(',')
  } else if (feature.attributes.get('gff_id')) {
    id = feature.attributes.get('gff_id')?.join(',')
  } else {
    id = feature._id
  }
  return `${feature.type} ${id} [${feature.min + 1}-${feature.max}]`
}

export function DeleteFeature({
  changeManager,
  handleClose,
  selectedFeature,
  session,
  setSelectedFeature,
  sourceAssemblyId,
  sourceFeature,
}: DeleteFeatureProps) {
  const { notify } = session as unknown as AbstractSessionModel
  const [errorMessage, setErrorMessage] = useState('')
  const [featureToDelete, setFeatureToDelete] = useState<
    AnnotationFeature | undefined
  >()

  useEffect(() => {
    setFeatureToDelete(sourceFeature)
  }, [sourceFeature])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (!featureToDelete) {
      return
    }
    if (selectedFeature?._id === featureToDelete._id) {
      setSelectedFeature()
    }

    // Delete features
    const change = new DeleteFeatureChange({
      changedIds: [featureToDelete._id],
      typeName: 'DeleteFeatureChange',
      assembly: sourceAssemblyId,
      deletedFeature: getSnapshot(featureToDelete),
      parentFeatureId: featureToDelete.parent?._id,
    })
    await changeManager.submit(change)
    notify('Feature deleted successfully', 'success')
    handleClose()
    event.preventDefault()
  }

  const handleChange = (event: SelectChangeEvent) => {
    const selectedId = event.target.value
    const selectedFeature = Object.values(candidateFeatures).find(
      (f) => f._id === selectedId,
    )
    if (selectedFeature) {
      setFeatureToDelete(selectedFeature)
    }
  }

  const candidateFeatures: Record<string, AnnotationFeature> = {}
  candidateFeatures[sourceFeature._id] = sourceFeature
  Object.entries(getParents(sourceFeature)).map(([k, v]) => {
    candidateFeatures[k] = v
  })
  Object.entries(getChildren(sourceFeature)).map(([k, v]) => {
    candidateFeatures[k] = v
  })

  return (
    <Dialog
      open
      title="Delete feature"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="delete-feature"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          {'Select feature to delete'}
          <FormControl style={{ marginTop: 5 }}>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              name="radio-buttons-group"
              value={featureToDelete?._id}
              onChange={handleChange}
            >
              {Object.entries(candidateFeatures).map(([key, feature]) => (
                <FormControlLabel
                  key={key}
                  value={feature._id}
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center">
                      {makeRadioButtonName(candidateFeatures[key])}
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
              Object.keys(candidateFeatures).length === 0 ||
              featureToDelete === undefined
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
